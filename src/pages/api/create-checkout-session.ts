import type { APIRoute } from 'astro';
import { PUBLIC_SITE_URL } from 'astro:env/server';
import { createCheckoutSession } from '../../lib/stripe/checkout';
import {
  BusyError,
  SalesClosedError,
  SoldOutError,
  attachSession,
  cancelOrder,
  getShopEnabled,
  getShopSellable,
  getTicketSellable,
  reserveAndCreateOrder,
  type Sellable,
} from '../../lib/orders';
import { verifyTurnstile } from '../../lib/turnstile';

export const prerender = false;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Sanity document IDs and array keys: letters, digits, dashes, underscores (+ dots for IDs).
const DOC_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY_BYTES = 1024;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/**
 * Only our own pages may call this. Browsers always send Origin on POST, and
 * requiring JSON forces a CORS preflight for cross-site callers, which we
 * don't answer — so other sites can't trigger checkouts from a visitor's browser.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([new URL(request.url).origin]);
  if (PUBLIC_SITE_URL) allowed.add(new URL(PUBLIC_SITE_URL).origin);
  return allowed.has(origin);
}

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return json({ error: 'Forbidden' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'Bad request' }, 415);
  }

  // --- Parse + validate input (the client only sends IDs + qty; never prices) ---
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Bad request' }, 413);

  let body: { slug?: unknown; gigId?: unknown; ticketKey?: unknown; qty?: unknown; turnstileToken?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  // Either merch ({ slug }) or a ticket ({ gigId, ticketKey }).
  const { slug, gigId, ticketKey } = body;
  const qty = body.qty === undefined ? 1 : body.qty;
  const isTicket = gigId !== undefined || ticketKey !== undefined;
  if (isTicket) {
    if (typeof gigId !== 'string' || !DOC_ID_RE.test(gigId) || typeof ticketKey !== 'string' || !KEY_RE.test(ticketKey)) {
      return json({ error: 'Bad request' }, 400);
    }
  } else if (typeof slug !== 'string' || slug.length > 96 || !SLUG_RE.test(slug)) {
    return json({ error: 'Bad request' }, 400);
  }
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) {
    return json({ error: 'Invalid quantity' }, 400);
  }

  // Bot check before touching Sanity/Stripe, so scripts can't tie up stock.
  if (!(await verifyTurnstile(body.turnstileToken, request.headers.get('cf-connecting-ip')))) {
    return json({ error: 'Verification failed, please try again' }, 403);
  }

  try {
    // Fresh (non-CDN) reads: checkout must never act on stale settings/prices/stock.
    let item: Sellable | null;
    if (isTicket) {
      // Tickets are switched on per gig ("Sold on this site"), not by the shop switch.
      try {
        item = await getTicketSellable(gigId as string, ticketKey as string);
      } catch (err) {
        if (err instanceof SalesClosedError) return json({ error: err.message }, 409);
        throw err;
      }
    } else {
      if (!(await getShopEnabled())) return json({ error: 'Shop is not open yet' }, 403);
      item = await getShopSellable(slug as string);
    }
    if (!item) return json({ error: 'Item not found' }, 404);

    // --- Reserve stock + create pending order (atomic) ---
    const orderId = crypto.randomUUID();
    try {
      await reserveAndCreateOrder(item, orderId, qty);
    } catch (err) {
      if (err instanceof SoldOutError) return json({ error: 'Sold out' }, 409);
      if (err instanceof RangeError) return json({ error: 'Invalid quantity' }, 400);
      throw err;
    }

    // --- Create the Stripe Checkout Session; give the stock back if that fails ---
    const siteUrl = PUBLIC_SITE_URL || new URL(request.url).origin;
    let session;
    try {
      session = await createCheckoutSession({ item, qty, orderId, siteUrl });
    } catch (err) {
      await cancelOrder(orderId).catch((e) => console.error('cancelOrder failed', orderId, e));
      throw err;
    }

    // Convenience link for the Studio/reconciliation; the webhook relies on metadata, not this.
    await attachSession(orderId, session.id).catch((e) =>
      console.error('attachSession failed', orderId, e),
    );

    return json({ url: session.url }, 200);
  } catch (err) {
    if (err instanceof BusyError) {
      // Burst of buyers: Sanity is rate-limiting writes. Nothing was reserved.
      return json({ error: 'High demand right now, please try again in a moment' }, 503);
    }
    console.error('create-checkout-session failed', err);
    return json({ error: 'Checkout is unavailable right now' }, 500);
  }
};
