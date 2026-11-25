import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { sanityWrite } from '../../lib/sanity-write';

export const prerender = false;

/**
 * For the uptime monitor: 200 = the site can take orders, 503 = something it
 * depends on is broken. Checks that Sanity answers with our write token (the
 * site, stock and orders all depend on it) and that the payment settings are
 * present. Deliberately says nothing about *which* setting is missing — look
 * at the Worker's settings if `config` is false.
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
  const config = REQUIRED_SETTINGS.every((name) => !!getSecret(name));

  const ok = sanity && config;
  return new Response(JSON.stringify({ ok, sanity, config }), {
    status: ok ? 200 : 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
};
