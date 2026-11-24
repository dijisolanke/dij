# Content Studio

This is the Sanity Studio used to manage every page of the site — About Diji, Gigs, Projects, Shop Items, Watch Entries, and Site Settings — edit content here and it appears on the live site within about a minute, with no code changes or redeploys.

## One-time setup (do this once, requires a free Sanity.io account)

1. `cd studio`
2. `npm install`
3. `npx sanity login` — opens a browser to log in or create a free Sanity account.
4. `npx sanity init --env` — creates a new Sanity project, picks (or creates) a dataset named `production`, and writes `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET` into a local `.env` file. When it asks whether to use the existing schema, say yes / don't overwrite `schemaTypes`.
   - Alternatively, copy `.env.example` to `.env` and fill in the project ID manually if you already have a Sanity project.
5. `npm run dev` — runs the Studio locally at `http://localhost:3333`.
6. `npm run deploy` — publishes the hosted Studio at `https://dijiofficial.sanity.studio`, so content can be edited from any device without running anything locally. Redeploy after any change in this folder (e.g. schema changes).

## Using the Studio

- Open it at **dijiofficial.com/admin** (or dev.dijiofficial.com/admin for the test data). You sign in with your Sanity account.
- It has two workspaces, switched from the menu at the top left:
  - **Diji — live site**: the real site's content, stock and orders.
  - **Diji — TEST site**: test data for dev.dijiofficial.com. Safe to experiment.
- To give someone access (e.g. an assistant): sanity.io/manage → this project → **Members → Invite**, role **Editor**.

## After setup

Copy the same `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` values into the main site's `.env` (see the project root `.env.example`) as `PUBLIC_SANITY_PROJECT_ID` / `PUBLIC_SANITY_DATASET`, and into the Cloudflare Worker's build variables, so the website can read the same content.
