// @ts-check
import { defineConfig, envField } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // Images come from Sanity's CDN (@sanity/image-url), not astro:assets,
  // so no Cloudflare Images binding is needed.
  adapter: cloudflare({ imageService: 'passthrough' }),
  // Astro sessions aren't used; skip the KV namespace the adapter would add.
  session: false,

  // Typed env. Secrets are server-only and never bundled; locally they come
  // from .env, in production from Cloudflare (Settings → Variables and Secrets).
  env: {
    // Secrets are runtime-only on Cloudflare (not available to the build), so
    // they're validated when the server first uses them, not at build time.
    // A missing secret then fails loudly at runtime (500 + log), never silently.
    validateSecrets: false,
    schema: {
      PUBLIC_SANITY_PROJECT_ID: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_SANITY_DATASET: envField.string({ context: 'client', access: 'public', default: 'production' }),
      PUBLIC_SITE_URL: envField.string({ context: 'server', access: 'public', optional: true }),

      STRIPE_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
      STRIPE_WEBHOOK_SECRET: envField.string({ context: 'server', access: 'secret' }),
      // Editor-role token: checkout reads fresh data and writes stock + orders.
      SANITY_WRITE_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      // Optional: comma-separated shr_ IDs. Empty = shipping built into prices.
      STRIPE_SHIPPING_RATE_IDS: envField.string({ context: 'server', access: 'secret', optional: true }),

      // Cloudflare Turnstile (bot check on Buy). For local dev use Cloudflare's
      // test keys (see .env.example); real keys only work on configured domains.
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public' }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});
