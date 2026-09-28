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

## Supabase auth/profile setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_auth_profile_foundation.sql` in the SQL editor or via the Supabase CLI.
3. Copy `.env.example` to `.env.local` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - optional server-only `SUPABASE_SERVICE_ROLE_KEY`
4. In Supabase Auth providers, enable Email and Magic Link. Enable Google OAuth when client credentials are ready. Apple OAuth is intentionally scaffolded for later provider activation.
5. Add local redirect URLs such as `http://localhost:5173/account` and `http://localhost:5173/reset-password` to Supabase Auth URL configuration.

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
