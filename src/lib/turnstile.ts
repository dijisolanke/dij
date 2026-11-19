import { TURNSTILE_SECRET_KEY } from 'astro:env/server';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Must match the `action` the widget is rendered with on the product page. */
export const TURNSTILE_ACTION = 'checkout';

/**
 * Server-side check of a Cloudflare Turnstile token (bot protection on Buy).
 * Tokens are single-use and valid for 5 minutes. The client can't fake a
 * pass: only Cloudflare can mint a token that verifies against our secret.
 */
export async function verifyTurnstile(token: unknown, remoteIp: string | null): Promise<boolean> {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

  const form = new FormData();
  form.append('secret', TURNSTILE_SECRET_KEY);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body: form });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; action?: string; 'error-codes'?: string[] };
    if (!data.success) {
      console.warn('Turnstile rejected', data['error-codes']);
      return false;
    }
    // Test keys don't echo an action; real widgets do.
    if (data.action && data.action !== TURNSTILE_ACTION) return false;
    return true;
  } catch (err) {
    console.error('Turnstile verification error', err);
    return false; // fail closed
  }
}
