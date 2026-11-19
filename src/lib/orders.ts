import { sanityWrite } from './sanity-write';
import type { SanityImage } from './sanity';

/**
 * Orders and stock live in Sanity. Every stock change goes through a
 * transaction locked to the document revision it read (ifRevisionId), so two
 * buyers can never both claim the last unit: one commit wins, the other gets
 * a 409 conflict, re-reads and tries again.
 *
 * Order IDs use the `orders.` prefix. Sanity treats IDs containing a dot as
 * private, so customer emails/addresses are never readable through the public
 * (unauthenticated) API — only with a token or in the Studio.
 */

export type OrderStatus = 'pending' | 'processing' | 'paid' | 'expired' | 'cancelled' | 'failed';

export interface CheckoutItem {
  _id: string;
  _rev: string;
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

interface OrderDoc {
  _id: string;
  _rev: string;
  status: OrderStatus;
  qty: number;
  stockReserved: boolean;
  item?: { _ref: string };
  expectedAmount?: number;
  expectedCurrency?: string;
}

export class SoldOutError extends Error {}

/** Whole currency units from Sanity → integer minor units (pence) for Stripe. */
export const toMinorUnits = (amount: number) => Math.round(amount * 100);

export const itemCurrency = (item: Pick<CheckoutItem, 'currency'>) => (item.currency || 'gbp').toLowerCase();

const MAX_ATTEMPTS = 4;

export const orderDocId = (orderId: string) => `orders.${orderId}`;

function isConflict(err: unknown): boolean {
  const status = (err as { statusCode?: number })?.statusCode;
  return status === 409;
}

export async function getShopEnabled(): Promise<boolean> {
  const enabled = await sanityWrite.fetch<boolean | null>(`*[_type == "siteSettings"][0].shopEnabled`);
  return enabled === true;
}

export async function getCheckoutItem(slug: string): Promise<CheckoutItem | null> {
  return sanityWrite.fetch(
    `*[_type == "shopItem" && slug.current == $slug][0]{
      _id, _rev, title, slug, description, price, currency, type, images, soldOut, stock, maxPerOrder
    }`,
    { slug },
  );
}

/**
 * Atomically reserves `qty` units (if the item tracks stock) and creates the
 * pending order in the same transaction — both happen or neither does.
 */
export async function reserveAndCreateOrder(
  slug: string,
  orderId: string,
  qty: number,
): Promise<CheckoutItem> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const item = await getCheckoutItem(slug);
    if (!item) throw new SoldOutError('Item not found');

    const tracksStock = typeof item.stock === 'number';
    if (item.soldOut || (tracksStock && item.stock! < qty)) {
      throw new SoldOutError('Not enough stock');
    }

    const tx = sanityWrite.transaction();
    if (tracksStock) {
      tx.patch(item._id, (p) => p.ifRevisionId(item._rev).dec({ stock: qty }));
    }
    tx.create({
      _id: orderDocId(orderId),
      _type: 'order',
      status: 'pending' satisfies OrderStatus,
      item: { _type: 'reference', _ref: item._id, _weak: true },
      itemTitle: item.title,
      qty,
      // Snapshot of what Stripe should charge (excl. shipping), checked by the webhook.
      expectedAmount: toMinorUnits(item.price) * qty,
      expectedCurrency: itemCurrency(item),
      stockReserved: tracksStock,
      source: 'site',
      createdAt: new Date().toISOString(),
    });

    try {
      await tx.commit();
      return item;
    } catch (err) {
      if (isConflict(err) && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }
  throw new Error('Could not reserve stock');
}

async function getOrder(orderId: string): Promise<OrderDoc | null> {
  return sanityWrite.getDocument<OrderDoc>(orderDocId(orderId)) as Promise<OrderDoc | null>;
}

/**
 * Moves an order out of `from` statuses into `to`, returning reserved stock if
 * asked. Locked to the order's revision, so concurrent/retried webhooks can't
 * apply the same transition twice. Returns false if there was nothing to do.
 */
async function transition(
  orderId: string,
  from: OrderStatus[],
  to: OrderStatus,
  fields: Record<string, unknown> | ((order: OrderDoc) => Record<string, unknown>) = {},
  { releaseStock = false } = {},
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const order = await getOrder(orderId);
    if (!order || !from.includes(order.status)) return false;

    const extra = typeof fields === 'function' ? fields(order) : fields;
    const tx = sanityWrite.transaction();
    tx.patch(order._id, (p) =>
      p.ifRevisionId(order._rev).set({ ...extra, status: to, updatedAt: new Date().toISOString() }),
    );
    if (releaseStock && order.stockReserved && order.item?._ref) {
      // inc is atomic in Sanity, no revision lock needed on the item.
      tx.patch(order.item._ref, (p) => p.inc({ stock: order.qty }));
    }

    try {
      await tx.commit();
      return true;
    } catch (err) {
      if (isConflict(err) && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }
  return false;
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

export const attachSession = (orderId: string, stripeSessionId: string) =>
  sanityWrite.patch(orderDocId(orderId)).set({ stripeSessionId }).commit();

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

export const markPaid = (orderId: string, details: PaymentDetails) =>
  transition(orderId, ['pending', 'processing'], 'paid', (order) => ({
    ...details,
    ...amountCheck(order, details),
  }));

/** Checkout completed but a delayed payment method hasn't settled yet. Stock stays reserved. */
export const markProcessing = (orderId: string, details: PaymentDetails) =>
  transition(orderId, ['pending'], 'processing', { ...details });

export const markExpired = (orderId: string) =>
  transition(orderId, ['pending'], 'expired', {}, { releaseStock: true });

export const markFailed = (orderId: string) =>
  transition(orderId, ['pending', 'processing'], 'failed', {}, { releaseStock: true });

/** Stripe session creation failed after we reserved stock. */
export const cancelOrder = (orderId: string) =>
  transition(orderId, ['pending'], 'cancelled', {}, { releaseStock: true });

/**
 * Order paid outside our checkout (e.g. a Stripe Payment Link used during an
 * outage): there's no pending order, so record it and take the stock now.
 * createIfNotExists keeps this idempotent across webhook retries.
 */
export async function recordExternalOrder(
  orderId: string,
  itemId: string,
  qty: number,
  details: PaymentDetails,
): Promise<boolean> {
  const existing = await getOrder(orderId);
  if (existing) return false;

  const item = await sanityWrite.fetch<{ _id: string; title: string; stock?: number | null } | null>(
    `*[_id == $id][0]{_id, title, stock}`,
    { id: itemId },
  );

  const tx = sanityWrite.transaction();
  tx.create({
    _id: orderDocId(orderId),
    _type: 'order',
    status: 'paid' satisfies OrderStatus,
    item: item ? { _type: 'reference', _ref: item._id, _weak: true } : undefined,
    itemTitle: item?.title ?? itemId,
    qty,
    stockReserved: false,
    source: 'payment-link',
    createdAt: new Date().toISOString(),
    ...details,
  });
  if (item && typeof item.stock === 'number') {
    tx.patch(item._id, (p) => p.dec({ stock: qty }));
  }
  try {
    await tx.commit();
    return true;
  } catch (err) {
    // Another delivery of the same event created it first.
    if (isConflict(err)) return false;
    throw err;
  }
}
