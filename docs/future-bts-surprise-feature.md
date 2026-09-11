# Deferred: BTS Surprise/Prize Mechanic

**Status: not built. Do not implement until the artist has answered the open questions below.**

## The idea (in the artist's words)

On the BTS page, add a "surprise" element where fans can win random prizes — e.g. a free ticket or free merch. It's meant to feel like an easter egg: unexpected, not a prominently advertised promotion.

## Why this isn't built yet

The specifics weren't decided when the rest of the site was built (2026-09-11): which prizes, how often they're available, odds of winning, and how a "win" gets fulfilled are all open. Building speculative logic for undefined rules would likely have to be thrown away, so only a schema hook was added to keep the door open.

## What already exists to build on

- `studio/schemaTypes/btsEntry.ts` has an `entryType` field (`standard` | `surprise`, default `standard`). No code currently branches on this value — it's inert.
- The site's overall architecture (see the original build plan, or ask the artist/repo owner for it) is: Astro on Vercel (hybrid rendering — see `astro.config.mjs`), Sanity.io as the CMS (`src/lib/sanity.ts`), Stripe Checkout for payments (`src/pages/api/create-checkout-session.ts`, `src/lib/stripe.ts`). Any implementation of this feature should stay consistent with that stack rather than introducing a new one, to keep the site lightweight.
- The BTS page itself is `src/pages/bts.astro`, currently rendering CMS-driven entries with a `revealStyle` of `always-visible` or `tap-to-reveal`.

## Open questions to ask the artist before writing any code

1. **What are the actual prizes**, and is there a finite inventory of each (e.g. only 5 free tickets to give away) or is it unlimited?
2. **What triggers a win** — a fixed probability per visit/click, a limited-time drop, a code hidden somewhere, something else?
3. **Rate limiting** — can the same fan win more than once? If so, how is "the same fan" identified without adding heavyweight auth to an intentionally lightweight, mostly-anonymous site (a cookie? an email capture at the moment of winning?).
4. **Fulfillment** — does winning a "free ticket" mean generating a 100%-off Stripe coupon/promotion code programmatically, or does the artist want to review and send codes manually? Same question for free merch.
5. **Anti-abuse** — is any protection needed against a fan scripting/refreshing to farm wins, given there's no login system?

## Technical note

Sanity is a content store, not a transactional database — it is not a safe place to track "who has already won" or decrement limited inventory under concurrent requests. If the rules above require tracking state per-visitor or per-prize-inventory, this will likely need a small addition to the stack (e.g. Vercel KV or a similar lightweight store) rather than trying to force it into Sanity. Confirm this tradeoff with the artist once the rules are known, since it's the one place this feature would add a new moving part to an otherwise serverless, CMS-driven site.
