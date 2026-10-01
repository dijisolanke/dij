# Content Studio

This is the Sanity Studio used to manage every page of the site — About Merle, Gigs, Projects, Shop Items, Watch Entries, and Site Settings — edit content here and it appears on the live site within about a minute, with no code changes or redeploys.

## One-time setup (do this once, requires a free Sanity.io account)

1. `cd studio`
2. `npm install`
3. `npx sanity login` — opens a browser to log in or create a free Sanity account.
4. `npx sanity init --env` — creates a new Sanity project, picks (or creates) a dataset named `production`, and writes `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET` into a local `.env` file. When it asks whether to use the existing schema, say yes / don't overwrite `schemaTypes`.
   - Alternatively, copy `.env.example` to `.env` and fill in the project ID manually if you already have a Sanity project.
5. `npm run dev` — runs the Studio locally at `http://localhost:3333`.
6. `npm run deploy` — publishes a hosted Studio (e.g. `https://your-project.sanity.studio`) so content can be edited from any device without running anything locally.

## After setup

Copy the same `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` values into the main site's `.env` (see the project root `.env.example`) as `PUBLIC_SANITY_PROJECT_ID` / `PUBLIC_SANITY_DATASET`, and into the Vercel project's Environment Variables when deploying, so the website can read the same content.
