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
    validateSecrets: true,
    schema: {
      PUBLIC_SANITY_PROJECT_ID: envField.string({ context: 'client', access: 'public' }),
      PUBLIC_SANITY_DATASET: envField.string({ context: 'client', access: 'public', default: 'production' }),
      PUBLIC_SITE_URL: envField.string({ context: 'server', access: 'public', optional: true }),

      STRIPE_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
      STRIPE_WEBHOOK_SECRET: envField.string({ context: 'server', access: 'secret' }),
      // Used from Step 3 onwards (stock updates, shipping), so optional for now.
      SANITY_WRITE_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      STRIPE_SHIPPING_RATE_IDS: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
