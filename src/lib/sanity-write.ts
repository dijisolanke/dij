import { createClient } from '@sanity/client';
import { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } from 'astro:env/client';
import { SANITY_WRITE_TOKEN } from 'astro:env/server';

// Server-only client for anything money-related: fresh reads (no CDN, so
// prices and stock are never stale) and writes (stock, orders).
// Never import this from client-side code — the token can write to the dataset.
export const sanityWrite = createClient({
  projectId: PUBLIC_SANITY_PROJECT_ID,
  dataset: PUBLIC_SANITY_DATASET,
  apiVersion: '2025-02-19',
  token: SANITY_WRITE_TOKEN,
  useCdn: false,
  // Authenticated queries can see drafts; checkout must only ever use
  // published prices and stock.
  perspective: 'published',
});
