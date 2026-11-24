import type { APIRoute } from 'astro';
import { PUBLIC_SANITY_DATASET } from 'astro:env/client';

export const prerender = false;

/** Hosted Sanity Studio (studio/sanity.cli.ts → studioHost). */
const STUDIO_URL = 'https://dijiofficial.sanity.studio';

/**
 * /admin → the content Studio, opened on the workspace for this site's data:
 * the live site goes to the live workspace, the dev site to the test one.
 * Signing in (and who's allowed in) is handled by Sanity, not this site.
 * 302 (not 301) so browsers don't cache it — the destination may change when
 * the planned admin tools move in here.
 */
export const GET: APIRoute = () =>
  new Response(null, {
    status: 302,
    headers: {
      Location: `${STUDIO_URL}/${PUBLIC_SANITY_DATASET === 'production' ? 'production' : 'development'}`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
