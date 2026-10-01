# Artist Site

A lightweight musician website for and by Adediji Solanke for his art — every page's content is editable on the fly via Sanity Studio, no code changes needed.

## Stack

- **Frontend:** [Astro](https://astro.build) (server rendering) on [Vercel](https://vercel.com).
- **CMS:** [Sanity.io](https://sanity.io) — see `studio/README.md` for one-time setup.
- **Payments:** [Stripe Checkout](https://stripe.com/checkout), created dynamically per item via a Vercel serverless function.

Full architecture rationale: see the original plan at `/Users/diji/.claude/plans/i-want-to-create-abstract-lollipop.md`, and `docs/future-watch-surprise-feature.md` for a deferred feature note.

## Pages ↔ Sanity schemas

| Page              | Route       | Sanity schema                                                                                              |
| :---------------- | :---------- | :--------------------------------------------------------------------------------------------------------- |
| About Diji (home) | `/`         | `about` (singleton — bio text + photo)                                                                     |
| Gigs              | `/gigs`     | `gig` (optional event/act title, date, venue, city, sold out, notes)                                       |
| Projects          | `/projects` | `project` (title, image, description, links, quote)                                                        |
| Shop              | `/shop`     | `shopItem` (2–5 images, price, type); shop link's clickability is controlled by `siteSettings` (singleton) |
| Watch             | `/watch`    | `watchEntry` (title/body + a mix of images, uploaded videos, and video links)                              |

The sidebar shown on every page (site name, tagline, nav, social links) also comes from the `siteSettings` singleton — it's the one schema that isn't tied to a single page.

## Project Structure

```text
/
├── src/
│   ├── pages/
│   │   ├── index.astro          # About Diji (home)
│   │   ├── gigs.astro           # tour dates, from Sanity
│   │   ├── projects.astro       # other musical projects
│   │   ├── shop/
│   │   │   ├── index.astro      # shop list
│   │   │   ├── [slug].astro     # item detail + Buy button
│   │   │   └── success.astro    # post-checkout confirmation
│   │   ├── watch.astro          # video feed (uploads or YouTube/Vimeo links)
│   │   └── api/
│   │       ├── create-checkout-session.ts
│   │       └── stripe-webhook.ts
│   ├── components/               # Sidebar, Footer, Gallery
│   ├── layouts/Layout.astro
│   ├── lib/sanity.ts             # Sanity client + content queries
│   └── lib/stripe.ts             # Stripe client
├── studio/                       # Sanity Studio (separate app, own package.json)
│   └── schemaTypes/              # about, siteSettings, gig, project, shopItem, watchEntry
└── docs/future-watch-surprise-feature.md
```

### The Shop "coming soon" toggle

`siteSettings` is a singleton document in Sanity with a `shopEnabled` boolean. When turned off, the sidebar still shows the word "Shop" but renders it as plain, unclickable text rather than a link — the shop page itself is still reachable by direct URL, this only gates the menu entry.

## Setup

1. `npm install` (root) — installs the site's dependencies.
2. Set up Sanity: follow `studio/README.md`.
3. Copy `.env.example` to `.env` and fill in:
   - `PUBLIC_SANITY_PROJECT_ID` / `PUBLIC_SANITY_DATASET` (from step 2)
   - `STRIPE_SECRET_KEY` (test mode key from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys))
   - `STRIPE_WEBHOOK_SECRET` (from `stripe listen` locally, or the Stripe dashboard once deployed — see below)
4. `npm run dev` — starts the site at `http://localhost:4321`.
5. In Sanity Studio (`cd studio && npm run dev`), fill in the **About Diji** and **Site Settings** singletons under "Content" — the homepage shows an empty state until About Diji has a name, photo, and bio, and the sidebar needs Site Settings' site name (tagline and social links are optional).

## Testing Stripe locally

Install the [Stripe CLI](https://stripe.com/docs/stripe-cli), then in a separate terminal:

```sh
stripe listen --forward-to localhost:4321/api/stripe-webhook
```

This prints a webhook signing secret — put it in `.env` as `STRIPE_WEBHOOK_SECRET`. Use test card `4242 4242 4242 4242` (any future expiry, any CVC) to complete a checkout.

## Deployment

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. Import it in [Vercel](https://vercel.com/new).
3. Add the same environment variables from `.env` to the Vercel project's Environment Variables settings.
4. Add a Stripe webhook endpoint (in the Stripe dashboard) pointing at `https://<your-domain>/api/stripe-webhook`, subscribed to `checkout.session.completed`, and put its signing secret into Vercel's `STRIPE_WEBHOOK_SECRET`.
5. Deploy. Content changes made in Sanity Studio appear on the live site within about a minute — no redeploy needed.

## Commands

| Command                    | Action                                        |
| :------------------------- | :-------------------------------------------- |
| `npm run dev`              | Start local dev server at `localhost:4321`    |
| `npm run build`            | Build production site to `./dist/`            |
| `npm run preview`          | Preview the production build locally          |
| `cd studio && npm run dev` | Run Sanity Studio locally at `localhost:3333` |
