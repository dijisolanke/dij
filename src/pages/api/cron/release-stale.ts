import type { APIRoute } from 'astro';
import { CRON_SECRET } from 'astro:env/server';
import { releaseStaleReservations } from '../../../lib/reconcile';
import { sendPendingConfirmations } from '../../../lib/email/order-confirmation';

export const prerender = false;

/** Constant-time comparison, so the secret can't be guessed byte by byte from timings. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Scheduled cleanup of stuck reservations, plus retrying any order
 * confirmation emails that didn't go out. Called every 15 minutes by the
 * Cloudflare Cron Trigger (src/worker.ts), in-process. Host-neutral: any
 * scheduler that can POST with the secret (e.g. GitHub Actions) works too.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!CRON_SECRET) {
    console.error('CRON_SECRET not set — stale reservation cleanup is disabled');
    return new Response('Cleanup disabled', { status: 503 });
  }
  const auth = request.headers.get('authorization') ?? '';
  if (!safeEqual(auth, `Bearer ${CRON_SECRET}`)) return new Response('Forbidden', { status: 403 });

  try {
    const summary = await releaseStaleReservations();
    // Runs after cleanup, so orders it just recovered as paid get their email too.
    // Kept separate: an email problem must never stop stock being released.
    const confirmations = await sendPendingConfirmations().catch((err) => {
      console.error('Confirmation email retries failed', err);
      return { sent: 0, errors: 1 };
    });
    return new Response(JSON.stringify({ ...summary, confirmations }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Stale reservation cleanup failed', err);
    return new Response('Cleanup failed', { status: 500 });
  }
};
