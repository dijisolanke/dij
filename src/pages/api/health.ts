import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { sanityWrite } from '../../lib/sanity-write';

export const prerender = false;

/**
 * For the uptime monitor: 200 = the site can take orders, 503 = something it
 * depends on is broken. Checks that Sanity answers with our write token (the
 * site, stock and orders all depend on it) and that the payment settings are
 * present. `missing` lists the *names* of any missing settings (never values),
 * so whoever looks after the site knows what to add in the Worker's settings.
 */
const REQUIRED_SETTINGS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SANITY_WRITE_TOKEN',
  'TURNSTILE_SECRET_KEY',
  'CRON_SECRET',
  'RESEND_API_KEY',
];

export const GET: APIRoute = async () => {
  const sanity = await Promise.race([
    sanityWrite.fetch<number>('count(*[_type == "siteSettings"])').then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5000)),
  ]).catch(() => false);

  // getSecret returns undefined for a missing value instead of throwing.
  const missing = REQUIRED_SETTINGS.filter((name) => !getSecret(name));
  const config = missing.length === 0;

  const ok = sanity && config;
  return new Response(JSON.stringify({ ok, sanity, config, ...(config ? {} : { missing }) }), {
    status: ok ? 200 : 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
};
