#!/usr/bin/env node
/**
 * Build Pantry Talk's static recipe-image catalog without using an LLM.
 *
 * Sources:
 *  - TheMealDB: first ~793 records, API-provided image + source/canonical URL.
 *  - Wikibooks Cookbook: fills the catalog to TARGET_COUNT with recipes that have images.
 *
 * The script downloads the selected thumbnails into public/recipe-catalog so the app never
 * hotlinks random publisher/social images at runtime. It also writes the attribution/source
 * metadata into src/data/recipe-catalog.generated.ts.
 *
 * Development note: TheMealDB permits the test key `1` for development. Before publishing
 * a commercial/app-store build, use a supporter key and comply with their attribution terms.
 */

import { mkdir, writeFile, rm, access, readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createHash } from "node:crypto";

const TARGET_COUNT = Number(process.env.RECIPE_CATALOG_COUNT || 1000);
const THEMEALDB_KEY = process.env.THEMEALDB_API_KEY || "1";

const OUT_DIR = new URL("../public/recipe-catalog/", import.meta.url);
const GENERATED_FILE = new URL(
  "../src/data/recipe-catalog.generated.ts",
  import.meta.url,
);
const MANIFEST_FILE = new URL(
  "../public/recipe-catalog/manifest.json",
  import.meta.url,
);

const CONCURRENCY = Math.max(
  1,
  Math.min(8, Number(process.env.RECIPE_IMAGE_CONCURRENCY || 3)),
);

const WIKIMEDIA_DELAY_MS = Math.max(
  500,
  Number(process.env.WIKIMEDIA_DELAY_MS || 1200),
);

const CLEAN_BUILD = process.env.RECIPE_CATALOG_CLEAN === "1";

const USER_AGENT =
  "PantryTalkRecipeCatalog/0.2 (+https://github.com/kamalpraven/pantry-talk-app; contact via GitHub)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response, attempt) {
  const retryAfter = response?.headers?.get?.("retry-after");

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds)) {
      return Math.max(1000, seconds * 1000);
    }

    const when = Date.parse(retryAfter);

    if (Number.isFinite(when)) {
      return Math.max(1000, when - Date.now());
    }
  }

  return Math.min(30000, 1500 * 2 ** attempt) + Math.floor(Math.random() * 400);
}

async function fetchJson(url, retries = 6) {
  let last;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    let response;

    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Api-User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        return await response.json();
      }

      const error = new Error(
        `${response.status} ${response.statusText}`,
      );

      last = error;

      if (![429, 500, 502, 503, 504].includes(response.status)) {
        throw error;
      }

      const wait = retryDelayMs(response, attempt);

      console.warn(
        `HTTP ${response.status} from ${
          new URL(url).hostname
        }; retrying in ${Math.ceil(wait / 1000)}s...`,
      );

      await sleep(wait);
    } catch (error) {
      last = error;

      if (
        response &&
        ![429, 500, 502, 503, 504].includes(response.status)
      ) {
        throw error;
      }

      if (!response) {
        const wait = Math.min(30000, 1500 * 2 ** attempt);
        await sleep(wait);
      }
    }
  }

  throw last;
}

function normalized(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(recipe|style|easy|classic|homemade)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slug(value) {
  const base = normalized(value)
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const suffix = createHash("sha1")
    .update(value)
    .digest("hex")
    .slice(0, 7);

  return `${base || "recipe"}-${suffix}`;
}

function cleanText(value) {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function safeUrl(value) {
  if (
    typeof value !== "string" ||
    !/^https:\/\//i.test(value)
  ) {
    return "";
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* TheMealDB                                                                  */
/* -------------------------------------------------------------------------- */

async function fetchTheMealDb() {
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  const groups = [];

  for (let i = 0; i < letters.length; i += 5) {
    groups.push(letters.slice(i, i + 5));
  }

  const out = [];

  for (const group of groups) {
    const payloads = await Promise.all(
      group.map((letter) =>
        fetchJson(
          `https://www.themealdb.com/api/json/v1/${THEMEALDB_KEY}/search.php?f=${letter}`,
        ),
      ),
    );

    for (const payload of payloads) {
      for (const meal of payload.meals || []) {
        const name = cleanText(meal.strMeal);
        const remoteImage = safeUrl(meal.strMealThumb);

        if (!name || !remoteImage || !meal.idMeal) {
          continue;
        }

        out.push({
          id: `themealdb-${meal.idMeal}`,
          name,
          remoteImage,

          url:
            safeUrl(meal.strSource) ||
            `https://www.themealdb.com/meal/${meal.idMeal}`,

          canonicalUrl: `https://www.themealdb.com/meal/${meal.idMeal}`,

          provider: "TheMealDB",
          providerUrl: "https://www.themealdb.com/",

          license:
            cleanText(meal.strCreativeCommonsConfirmed) || null,

          licenseUrl: null,
          attribution: "TheMealDB",
        });
      }
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Wikibooks                                                                  */
/* -------------------------------------------------------------------------- */

async function fetchWikibooksCandidates(limit = 700) {
  const out = [];
  let cont = {};

  while (out.length < limit) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",

      generator: "categorymembers",
      gcmtitle: "Category:Recipes with images",
      gcmlimit: "200",

      maxlag: "5",

      prop: "pageimages|info",
      piprop: "thumbnail|name",
      pithumbsize: "640",
      inprop: "url",

      ...cont,
    });

    const payload = await fetchJson(
      `https://en.wikibooks.org/w/api.php?${params}`,
    );

    for (const page of payload?.query?.pages || []) {
      if (
        !page.title?.startsWith("Cookbook:") ||
        !page.thumbnail?.source
      ) {
        continue;
      }

      const name = cleanText(
        page.title.replace(/^Cookbook:/, ""),
      );

      if (!name) {
        continue;
      }

      const fallbackUrl =
        `https://en.wikibooks.org/wiki/${encodeURIComponent(
          page.title.replace(/ /g, "_"),
        )}`;

      out.push({
        id: `wikibooks-${page.pageid}`,
        name,

        remoteImage: safeUrl(page.thumbnail.source),

        url: safeUrl(page.fullurl) || fallbackUrl,
        canonicalUrl: safeUrl(page.fullurl) || fallbackUrl,

        provider: "Wikibooks Cookbook",
        providerUrl:
          "https://en.wikibooks.org/wiki/Cookbook:Recipes",

        license:
          "CC BY-SA (page content; image license may differ)",

        licenseUrl:
          "https://creativecommons.org/licenses/by-sa/4.0/",

        attribution:
          "Wikibooks / Wikimedia contributors",
      });
    }

    if (!payload.continue) {
      break;
    }

    cont = payload.continue;

    // Important: avoid Wikimedia 429 throttling.
    await sleep(WIKIMEDIA_DELAY_MS);
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

function contentExtension(contentType, url) {
  if (/image\/webp/i.test(contentType)) {
    return ".webp";
  }

  if (/image\/png/i.test(contentType)) {
    return ".png";
  }

  if (/image\/(?:jpeg|jpg)/i.test(contentType)) {
    return ".jpg";
  }

  const ext = extname(
    new URL(url).pathname,
  ).toLowerCase();

  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return ext === ".jpeg" ? ".jpg" : ext;
  }

  return ".jpg";
}

/**
 * If a previous build already downloaded this image,
 * reuse it instead of fetching again.
 */
async function existingImagePath(candidate) {
  const base = slug(candidate.name);

  for (const extension of [
    ".webp",
    ".png",
    ".jpg",
  ]) {
    const fileName = `${base}${extension}`;

    try {
      await access(
        new URL(fileName, OUT_DIR),
      );

      const bytes = await readFile(
        new URL(fileName, OUT_DIR),
      );

      if (bytes.length >= 2000) {
        return {
          ...candidate,
          image: `/recipe-catalog/${fileName}`,
          imageBytes: bytes.length,
        };
      }
    } catch {
      // Try next extension.
    }
  }

  return null;
}

async function downloadImage(
  candidate,
  retries = 5,
) {
  const cached =
    await existingImagePath(candidate);

  if (cached) {
    return cached;
  }

  const host = new URL(
    candidate.remoteImage,
  ).hostname;

  const isWikimedia =
    /(?:wikimedia|wikibooks)\.org$/i.test(
      host,
    ) ||
    /upload\.wikimedia\.org$/i.test(
      host,
    );

  for (
    let attempt = 0;
    attempt < retries;
    attempt += 1
  ) {
    let response;

    try {
      // Slight jitter so many workers don't hit Wikimedia simultaneously.
      if (
        isWikimedia &&
        attempt === 0
      ) {
        await sleep(
          250 +
            Math.floor(
              Math.random() * 300,
            ),
        );
      }

      response = await fetch(
        candidate.remoteImage,
        {
          headers: {
            "User-Agent": USER_AGENT,
            "Api-User-Agent":
              USER_AGENT,

            Accept:
              "image/avif,image/webp,image/png,image/jpeg,image/*",
          },

          redirect: "follow",
        },
      );

      const type =
        response.headers.get(
          "content-type",
        ) || "";

      if (
        response.status === 429 ||
        response.status >= 500
      ) {
        const wait =
          retryDelayMs(
            response,
            attempt,
          );

        console.warn(
          `image HTTP ${
            response.status
          }: ${
            candidate.name
          }; retrying in ${Math.ceil(
            wait / 1000,
          )}s`,
        );

        await sleep(wait);
        continue;
      }

      if (
        !response.ok ||
        !type.startsWith("image/")
      ) {
        return null;
      }

      const bytes = Buffer.from(
        await response.arrayBuffer(),
      );

      // Ignore corrupt/tiny images and extremely large images.
      if (
        bytes.length < 2000 ||
        bytes.length > 2_500_000
      ) {
        return null;
      }

      const extension =
        contentExtension(
          type,
          response.url ||
            candidate.remoteImage,
        );

      const fileName =
        `${slug(
          candidate.name,
        )}${extension}`;

      await writeFile(
        new URL(fileName, OUT_DIR),
        bytes,
      );

      return {
        ...candidate,
        image:
          `/recipe-catalog/${fileName}`,
        imageBytes:
          bytes.length,
      };
    } catch (error) {
      if (
        attempt ===
        retries - 1
      ) {
        console.warn(
          `image failed: ${
            candidate.name
          }: ${
            error?.message ||
            error
          }`,
        );

        return null;
      }

      await sleep(
        Math.min(
          20000,
          1000 * 2 ** attempt,
        ),
      );
    }
  }

  return null;
}

async function mapConcurrent(
  items,
  limit,
  worker,
) {
  const results =
    new Array(items.length);

  let next = 0;

  async function run() {
    while (true) {
      const index = next++;

      if (
        index >=
        items.length
      ) {
        return;
      }

      results[index] =
        await worker(
          items[index],
          index,
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            limit,
            items.length,
          ),
      },
      run,
    ),
  );

  return results;
}

/* -------------------------------------------------------------------------- */
/* Output                                                                     */
/* -------------------------------------------------------------------------- */

function renderTs(entries) {
  const compact =
    entries.map(
      ({
        remoteImage,
        imageBytes,
        ...entry
      }) => entry,
    );

  return (
    `// AUTO-GENERATED by scripts/build-recipe-catalog.mjs. Do not edit by hand.\n` +
    `export type RecipeCatalogEntry = {\n` +
    `  id: string;\n` +
    `  name: string;\n` +
    `  image: string;\n` +
    `  url: string;\n` +
    `  canonicalUrl: string;\n` +
    `  provider: string;\n` +
    `  providerUrl: string;\n` +
    `  attribution: string;\n` +
    `  license: string | null;\n` +
    `  licenseUrl: string | null;\n` +
    `};\n\n` +
    `export const RECIPE_CATALOG = ${JSON.stringify(
      compact,
      null,
      2,
    )} as const satisfies readonly RecipeCatalogEntry[];\n`
  );
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log(
    `Building ${TARGET_COUNT}-recipe static catalog (no LLM calls)...`,
  );

  if (CLEAN_BUILD) {
    console.log(
      "Clean build requested; clearing cached images...",
    );

    await rm(
      OUT_DIR,
      {
        recursive: true,
        force: true,
      },
    );
  }

  await mkdir(
    OUT_DIR,
    {
      recursive: true,
    },
  );

  /*
   * Run the two sources sequentially instead of simultaneously.
   * This significantly reduces the chance of rate limiting.
   */
  const mealDb =
    await fetchTheMealDb();

  console.log(
    `TheMealDB candidates: ${mealDb.length}`,
  );

  await sleep(1000);

  const wikibooks =
    await fetchWikibooksCandidates(
      900,
    );

  console.log(
    `Candidates: TheMealDB=${mealDb.length}, Wikibooks=${wikibooks.length}`,
  );

  /*
   * Deduplicate by normalized recipe name.
   */
  const seen = new Set();
  const candidates = [];

  for (const item of [
    ...mealDb,
    ...wikibooks,
  ]) {
    const key =
      normalized(
        item.name,
      );

    if (
      !key ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    candidates.push(item);
  }

  console.log(
    `Unique recipe candidates: ${candidates.length}`,
  );

  /*
   * Download a surplus because some images may fail.
   */
  const selectedCandidates =
    candidates.slice(
      0,
      Math.min(
        candidates.length,
        TARGET_COUNT + 250,
      ),
    );

  console.log(
    `Attempting image download for ${selectedCandidates.length} candidates with concurrency=${CONCURRENCY}`,
  );

  const downloaded =
    await mapConcurrent(
      selectedCandidates,
      CONCURRENCY,
      async (
        candidate,
        index,
      ) => {
        const result =
          await downloadImage(
            candidate,
          );

        if (
          (index + 1) % 50 ===
          0
        ) {
          console.log(
            `Processed ${
              index + 1
            } / ${
              selectedCandidates.length
            } images`,
          );
        }

        return result;
      },
    );

  const entries =
    downloaded
      .filter(Boolean)
      .slice(
        0,
        TARGET_COUNT,
      );

  if (
    entries.length <
    TARGET_COUNT
  ) {
    throw new Error(
      `Only ${entries.length}/${TARGET_COUNT} recipes had cacheable images. ` +
        `Re-run the command to reuse downloaded images, or lower RECIPE_CATALOG_COUNT.`,
    );
  }

  await writeFile(
    GENERATED_FILE,
    renderTs(entries),
    "utf8",
  );

  await writeFile(
    MANIFEST_FILE,
    JSON.stringify(
      {
        generatedAt:
          new Date().toISOString(),

        count:
          entries.length,

        providers:
          entries.reduce(
            (acc, item) => {
              acc[
                item.provider
              ] =
                (acc[
                  item.provider
                ] || 0) +
                1;

              return acc;
            },
            {},
          ),

        note:
          "Static development snapshot. Preserve attribution and review source/image licenses before public commercial release.",

        recipes:
          entries.map(
            ({
              remoteImage,
              imageBytes,
              ...entry
            }) => ({
              ...entry,
              imageBytes,
            }),
          ),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("");
  console.log(
    `Done: ${entries.length} recipes`,
  );

  console.log(
    "Local images: public/recipe-catalog/",
  );

  console.log(
    "Generated: src/data/recipe-catalog.generated.ts",
  );

  console.log(
    "Generated: public/recipe-catalog/manifest.json",
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);