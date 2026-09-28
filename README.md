# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase Auth/Postgres

## Supabase setup

1. Create a Supabase project.
2. Run the migrations in order in the SQL editor or via the Supabase CLI:
   - `supabase/migrations/001_auth_profile_foundation.sql`
   - `supabase/migrations/002_persistent_pantry.sql`
   - `supabase/migrations/003_favorites_cooking_history.sql`
3. Copy `.env.example` to `.env.local` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - optional server-only `SUPABASE_SERVICE_ROLE_KEY`
4. In Supabase Auth providers, enable Email and Magic Link. Enable Google OAuth when client credentials are ready. Apple OAuth is intentionally scaffolded for later provider activation.
5. Add local redirect URLs such as `http://localhost:5173/account` and `http://localhost:5173/reset-password` to Supabase Auth URL configuration.

Migration 003 adds saved recipes, collections, cooking sessions, substitutions and recipe events. All tables use RLS with authenticated user ownership. Finished-dish photo URLs are schema-ready only; no storage bucket is required for this milestone.

## Favorites and cooking history

PantryTalk supports guest and account-backed recipe memory:

- Guest favorites use `pantrytalk.guest-favorites.v1` and are bounded to 50 recipes.
- Guest cooking history uses `pantrytalk.guest-history.v1` and is bounded to 25 sessions.
- Signed-in users store favorites/history in Supabase with per-user fallback caches.
- On sign-in, PantryTalk offers to migrate guest kitchen/activity to the account. Migration is idempotent and clears guest activity only after a successful account save.

Recipe snapshots use two levels:

- Favorites store a compact card snapshot.
- Cooking sessions store a durable cookable snapshot including ingredients and steps, so history and “Cook again” still work if a live-discovered recipe later disappears from runtime cache.

Local validation workflow:

```bash
npm test
npm run build
npm run lint
```

## Static recipe catalog

Pantry Talk now supports a repo-owned recipe/image catalog so recipe cards do not rely on arbitrary
publisher/social preview images at runtime.

Build the 1,000-item development snapshot once from source-backed APIs:

```bash
npm run recipes:build-catalog
npm run recipes:verify-catalog
```

The builder uses **no LLM calls**. It prefers TheMealDB, then fills to 1,000 from Wikibooks recipes
with images. Images are downloaded into `public/recipe-catalog/`, while recipe name, local image path,
source URL, provider and attribution metadata are written to `src/data/recipe-catalog.generated.ts`
and `public/recipe-catalog/manifest.json`.

For a public/commercial release, review image licenses/attribution and use a production TheMealDB
supporter key as required by its terms.

## Static recipe catalog

Pantry Talk now supports a repo-owned recipe/image catalog so recipe cards do not rely on arbitrary
publisher/social preview images at runtime.

Build the 1,000-item development snapshot once from source-backed APIs:

```bash
npm run recipes:build-catalog
npm run recipes:verify-catalog
```

The builder uses **no LLM calls**. It prefers TheMealDB, then fills to 1,000 from Wikibooks recipes
with images. Images are downloaded into `public/recipe-catalog/`, while recipe name, local image path,
source URL, provider and attribution metadata are written to `src/data/recipe-catalog.generated.ts`
and `public/recipe-catalog/manifest.json`.

For a public/commercial release, review image licenses/attribution and use a production TheMealDB
supporter key as required by its terms.
