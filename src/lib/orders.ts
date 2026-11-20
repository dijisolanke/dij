import { sanityWrite } from './sanity-write';
import type { SanityImage } from './sanity';

/**
 * Orders and stock live in Sanity.
 *
 * - Reserving stock uses "decrement, then check" (see reserveAndCreateOrder):
 *   atomic, conflict-free under bursts, and can never oversell.
 * - Order status changes are locked to the order's revision (ifRevisionId), so
 *   retried/concurrent webhooks can't apply the same transition twice.
 * - Money taken always wins: a payment is recorded even if its order was
 *   already released or is missing (flagged for review), never dropped.
 * - Stuck reservations are released by the scheduled cleanup (reconcile.ts).
 *
 * Order IDs use the `orders.` prefix. Sanity treats IDs containing a dot as
 * private, so customer emails/addresses are never readable through the public
 * (unauthenticated) API — only with a token or in the Studio.
 */

export type OrderStatus = 'pending' | 'processing' | 'paid' | 'expired' | 'cancelled' | 'failed';

/** Statuses where the reservation has been given back. */
const RELEASED: OrderStatus[] = ['expired', 'cancelled', 'failed'];

export interface CheckoutItem {
  _id: string;
  title: string;
  slug: { current: string };
  description?: string;
  price: number;
  currency?: string;
  type: 'digital-ticket' | 'physical';
  images?: SanityImage[];
  soldOut?: boolean;
  /** Undefined/null = unlimited. */
  stock?: number | null;
  maxPerOrder?: number;
}

export interface OrderDoc {
  _id: string;
  _rev: string;
  status: OrderStatus;
  qty: number;
  stockReserved: boolean;
  item?: { _ref: string };
  expectedAmount?: number;
  expectedCurrency?: string;
  createdAt?: string;
  stripeSessionId?: string;
}

export class SoldOutError extends Error {}
/** Sanity is still rate-limiting us after the retry budget: tell the buyer to try again. */
export class BusyError extends Error {}

// All have 2 decimal places, so ×100 is correct. Adding a zero-decimal
// currency (e.g. JPY) needs toMinorUnits changing first — hence the allow-list.
const SUPPORTED_CURRENCIES = new Set(['gbp', 'usd', 'eur']);

/** Whole currency units from Sanity → integer minor units (pence) for Stripe. */
export const toMinorUnits = (amount: number) => Math.round(amount * 100);

export function itemCurrency(item: Pick<CheckoutItem, 'currency'>): string {
  const currency = (item.currency || 'gbp').toLowerCase();
  if (!SUPPORTED_CURRENCIES.has(currency)) throw new Error(`Unsupported currency: ${currency}`);
  return currency;
}

const MAX_ATTEMPTS = 4;
const DEFAULT_MAX_PER_ORDER = 4;

export const orderDocId = (orderId: string) => `orders.${orderId}`;
export const orderIdFromDocId = (docId: string) => docId.replace(/^orders\./, '');

const statusOf = (err: unknown) => (err as { statusCode?: number })?.statusCode;
const isConflict = (err: unknown) => statusOf(err) === 409;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

/**
 * Sanity allows ~25 writes/second per IP. Under a burst (ticket drop) it
 * answers 429; nothing was written, so it's safe to wait and retry. Jittered
 * backoff spreads retries out so they don't all collide again.
 * `fn` must build its transaction inside, so each attempt is self-contained.
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>, budgetMs = 8000): Promise<T> {
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (statusOf(err) !== 429) throw err;
      const delay = Math.min(400 * 2 ** attempt, 2000) * (0.5 + Math.random());
      if (Date.now() - started + delay > budgetMs) throw new BusyError('Sanity rate limit');
      await sleep(delay);
    }
  }
}

async function itemExists(itemId: string): Promise<boolean> {
  return (await sanityWrite.fetch<string | null>(`*[_id == $id][0]._id`, { id: itemId })) != null;
}

export async function getShopEnabled(): Promise<boolean> {
  const enabled = await sanityWrite.fetch<boolean | null>(`*[_type == "siteSettings"][0].shopEnabled`);
  return enabled === true;
}

export async function getCheckoutItem(slug: string): Promise<CheckoutItem | null> {
  return sanityWrite.fetch(
    `*[_type == "shopItem" && slug.current == $slug][0]{
      _id, title, slug, description, price, currency, type, images, soldOut, stock, maxPerOrder
    }`,
    { slug },
  );
}

/**
 * Reserves `qty` units and creates the pending order in ONE transaction.
 *
 * "Decrement, then check": Sanity applies `dec` atomically and in order, so
 * concurrent buyers never conflict with each other (no retry storms under
 * load). If the stock we see *after* our decrement is negative, there wasn't
 * enough left: we add our units back, delete our order, and report sold out.
 * Every successful buyer saw stock >= 0 after their own decrement, so the
 * total sold can never exceed the stock — no overselling.
 *
 * Trade-off: during a rush, losing buyers push stock briefly below zero until
 * their rollback lands, so someone may momentarily see "sold out" for a unit
 * that's about to come back (UI should say "check back shortly").
 */
export async function reserveAndCreateOrder(item: CheckoutItem, orderId: string, qty: number): Promise<void> {
  // This function is the trust boundary for stock: never rely on the caller alone.
  // (A negative qty would make `dec` *add* stock.)
  if (!Number.isInteger(qty) || qty < 1 || qty > (item.maxPerOrder ?? DEFAULT_MAX_PER_ORDER)) {
    throw new RangeError('Invalid quantity');
  }
  const currency = itemCurrency(item);
  if (item.soldOut) throw new SoldOutError('Sold out');
  const tracksStock = typeof item.stock === 'number';
  // Cheap early exit from the read we already have; the decrement below is authoritative.
  if (tracksStock && item.stock! < qty) throw new SoldOutError('Not enough stock');

  const docId = orderDocId(orderId);
  const docs = await withRateLimitRetry(() => {
    const tx = sanityWrite.transaction();
    if (tracksStock) tx.patch(item._id, (p) => p.dec({ stock: qty }));
    tx.create({
      _id: docId,
      _type: 'order',
      status: 'pending' satisfies OrderStatus,
      item: { _type: 'reference', _ref: item._id, _weak: true },
      itemTitle: item.title,
      qty,
      // Snapshot of what Stripe should charge (excl. shipping), checked by the webhook.
      expectedAmount: toMinorUnits(item.price) * qty,
      expectedCurrency: currency,
      stockReserved: tracksStock,
      source: 'site',
      createdAt: now(),
    });
    return tx.commit({ returnDocuments: true });
  });

  if (!tracksStock) return;
  const stockAfter = (docs.find((d) => d._id === item._id) as { stock?: number } | undefined)?.stock;
  if (typeof stockAfter === 'number' && stockAfter >= 0) return;

  // Oversubscribed: undo our reservation. If this fails, the scheduled
  // cleanup releases the order later (it has no Stripe session).
  try {
    await withRateLimitRetry(
      () => sanityWrite.transaction().patch(item._id, (p) => p.inc({ stock: qty })).delete(docId).commit(),
      20_000,
    );
  } catch (err) {
    console.error('Stock rollback failed; scheduled cleanup will release it', { itemId: item._id, qty, orderId }, err);
  }
  throw new SoldOutError('Not enough stock');
}

export async function getOrder(orderId: string): Promise<OrderDoc | null> {
  return (await sanityWrite.getDocument(orderDocId(orderId))) as OrderDoc | null;
}

type StockChange = 'release' | 'retake';

/**
 * Moves an order out of `from` statuses into `to`, optionally giving back
 * ('release') or re-claiming ('retake') its units. Locked to the order's
 * revision. Returns false if the order is missing or not in a `from` status.
 */
async function transition(
  orderId: string,
  from: OrderStatus[],
  to: OrderStatus,
  fields: Record<string, unknown> | ((order: OrderDoc) => Record<string, unknown>) = {},
  stockChange?: StockChange,
): Promise<boolean> {
  for (let attempt = 1; ; attempt++) {
    const order = await getOrder(orderId);
    if (!order || !from.includes(order.status)) return false;

    const extra = typeof fields === 'function' ? fields(order) : fields;
    const itemId = order.item?._ref;
    // Patching a deleted item would fail the whole transaction (and the
    // webhook would be retried for days), so skip the stock change if it's gone.
    const adjustStock = !!stockChange && order.stockReserved && !!itemId && (await itemExists(itemId));

    try {
      await withRateLimitRetry(() => {
        const tx = sanityWrite.transaction();
        tx.patch(order._id, (p) => p.ifRevisionId(order._rev).set({ ...extra, status: to, updatedAt: now() }));
        if (adjustStock) {
          // inc/dec are atomic in Sanity; no revision lock needed on the item.
          tx.patch(itemId!, (p) =>
            stockChange === 'release' ? p.inc({ stock: order.qty }) : p.dec({ stock: order.qty }),
          );
        }
        return tx.commit();
      });
      return true;
    } catch (err) {
      if (isConflict(err) && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }
}

export interface PaymentDetails {
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  /** Items only, excluding shipping — compared against expectedAmount. */
  amountSubtotal?: number;
  amountTotal?: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: Record<string, unknown>;
}

/** Convenience link for the Studio; webhooks/cleanup also record it, so failure is non-fatal. */
export const attachSession = (orderId: string, stripeSessionId: string) =>
  withRateLimitRetry(() => sanityWrite.patch(orderDocId(orderId)).set({ stripeSessionId }).commit());

/**
 * Defence in depth: the server builds every price, but if Stripe ever charged
 * something other than what Sanity said at checkout time (e.g. a session made
 * with a leaked key), the order is still recorded — money was taken — but
 * flagged in the Studio and logged so you can refund/investigate.
 */
function amountCheck(order: OrderDoc, details: PaymentDetails) {
  if (order.expectedAmount == null) return {};
  const mismatch =
    details.amountSubtotal !== order.expectedAmount || details.currency !== order.expectedCurrency;
  if (mismatch) {
    console.error('AMOUNT MISMATCH', order._id, {
      expected: [order.expectedAmount, order.expectedCurrency],
      charged: [details.amountSubtotal, details.currency],
    });
  }
  return { amountMismatch: mismatch };
}

const paidFields = (details: PaymentDetails, flags: Record<string, unknown> = {}) => (order: OrderDoc) => ({
  ...details,
  ...amountCheck(order, details),
  ...flags,
});

/**
 * Records a successful payment. Money taken always wins:
 *  - normal case: pending/processing → paid
 *  - order already released (expired/cancelled/failed, e.g. cleanup ran while
 *    webhooks were delayed by an outage): mark paid anyway, re-claim the stock
 *    (may go negative — correct, you owe this buyer), flag `paidAfterRelease`
 *  - order missing entirely: create it as paid, flag `orderMissing`
 */
export async function markPaid(
  orderId: string,
  details: PaymentDetails,
  fallback: { itemId?: string; qty?: number } = {},
): Promise<void> {
  if (await transition(orderId, ['pending', 'processing'], 'paid', paidFields(details))) return;

  const order = await getOrder(orderId);
  if (order?.status === 'paid') return; // duplicate delivery

  if (order && RELEASED.includes(order.status)) {
    console.error('PAID AFTER RELEASE — check stock/fulfilment', order._id, order.status);
    await transition(orderId, [order.status], 'paid', paidFields(details, { paidAfterRelease: true }), 'retake');
    return;
  }

  if (!order && fallback.itemId) {
    console.error('PAID BUT ORDER MISSING — recreating', orderId);
    await recordPaidOrder(orderId, fallback.itemId, fallback.qty ?? 1, details, {
      source: 'site',
      orderMissing: true,
    });
    return;
  }

  // Some state we didn't foresee: fail loudly (webhook 500 → Stripe retries, error in logs).
  throw new Error(`markPaid: cannot record payment for ${orderId} (status ${order?.status ?? 'missing'})`);
}

/** Checkout completed but a delayed payment method hasn't settled yet. Stock stays reserved. */
export const markProcessing = (orderId: string, details: PaymentDetails) =>
  transition(orderId, ['pending'], 'processing', { ...details });

export const markExpired = (orderId: string, stripeSessionId?: string) =>
  transition(orderId, ['pending'], 'expired', stripeSessionId ? { stripeSessionId } : {}, 'release');

export const markFailed = (orderId: string, stripeSessionId?: string) =>
  transition(orderId, ['pending', 'processing'], 'failed', stripeSessionId ? { stripeSessionId } : {}, 'release');

/** No usable Stripe session exists (creation failed, or none was ever made). */
export const cancelOrder = (orderId: string) => transition(orderId, ['pending'], 'cancelled', {}, 'release');

/**
 * Creates an order that's already paid and takes its stock now. Used for
 * Stripe Payment Links (outage fallback; no pending order exists) and for
 * the "order missing" safety net in markPaid. Idempotent: uses `create` with a
 * fixed ID, so a second delivery gets a 409 "already exists" and is ignored.
 */
export async function recordPaidOrder(
  orderId: string,
  itemId: string,
  qty: number,
  details: PaymentDetails,
  extra: Record<string, unknown> = { source: 'payment-link' },
): Promise<boolean> {
  if (await getOrder(orderId)) return false;

  const item = await sanityWrite.fetch<{ _id: string; title: string; stock?: number | null } | null>(
    `*[_id == $id][0]{_id, title, stock}`,
    { id: itemId },
  );

  try {
    await withRateLimitRetry(() => {
      const tx = sanityWrite.transaction();
      tx.create({
        _id: orderDocId(orderId),
        _type: 'order',
        status: 'paid' satisfies OrderStatus,
        item: item ? { _type: 'reference', _ref: item._id, _weak: true } : undefined,
        itemTitle: item?.title ?? itemId,
        qty,
        stockReserved: false,
        createdAt: now(),
        ...extra,
        ...details,
      });
      if (item && typeof item.stock === 'number') {
        tx.patch(item._id, (p) => p.dec({ stock: qty }));
      }
      return tx.commit();
    });
    return true;
  } catch (err) {
    if (isConflict(err)) return false; // another delivery created it first
    throw err;
  }
}

/** Pending orders older than the cutoff: candidates for the scheduled cleanup. */
export async function getStalePendingOrders(olderThan: Date, limit = 50): Promise<OrderDoc[]> {
  return sanityWrite.fetch(
    `*[_type == "order" && status == "pending" && createdAt < $cutoff] | order(createdAt asc)[0...$limit]{
      _id, _rev, status, qty, stockReserved, item, createdAt, stripeSessionId
    }`,
    { cutoff: olderThan.toISOString(), limit },
  );
}
