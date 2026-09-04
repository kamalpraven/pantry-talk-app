# Fill in photos for web-found recipes

Right now the web search almost never returns a photo link — I checked with a live search and every recipe came back with an empty photo field, which is why the cards show a plain placeholder. So the photo has to be found separately.

## What will change

1. For each recipe found on the web, the app visits the recipe's own page on the server and reads the page's own preview photo (the same image that shows up when you share a link on social media). That becomes the card photo.
2. Photos are loaded through the app itself instead of directly from the recipe site, so sites that block outside image use still display correctly.
3. If a page truly has no usable photo, the card falls back to one of the existing bundled food photos chosen to suit the dish, so cards never look empty.
4. Photo lookups happen for all recipes at once and are cached, so results still appear quickly and repeat searches are instant.

## Where it applies

Recipe result cards, the recipe detail page, and cooking mode all use the same photo, so they stay consistent.

## Technical notes

- New `src/lib/recipe-images.server.ts`: fetch each `sourceUrl` with a short timeout, parse `og:image` / `twitter:image` / `link rel=image_src` / first large `<img>`, resolve relative URLs, validate https, run in parallel with `Promise.allSettled` and a small concurrency cap; in-memory Map cache keyed by URL.
- `discoverRecipes` in `src/lib/linkup.functions.ts` calls that helper after normalisation and sets `imageUrl` before returning; recipes without one get a deterministic bundled image key.
- New public server route `src/routes/api/public/recipe-image.ts`: takes an `url` query param, allow-lists https, streams the image back with a cache header — used as the `src` for remote photos to avoid hotlink blocking.
- `RecipeImage.tsx`: route remote URLs through the proxy, keep the existing `onError` fallback, and use the bundled-photo fallback before the icon placeholder.
