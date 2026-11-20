import type Stripe from 'stripe';
import { stripe } from './stripe/client';
import { handleCompleted } from './stripe/webhook';
import { cancelOrder, getStalePendingOrders, markExpired, orderIdFromDocId, type OrderDoc } from './orders';

/**
 * Well past the 31-minute Stripe session lifetime, so any session for these
 * orders has certainly finished (paid or expired) by the time we look.
 */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * Finds the Stripe session for an order. Normally we stored its ID; if that
 * write failed (attachSession is best-effort), search sessions created around
 * the order's time for our orderId — a missing ID doesn't prove no session exists.
 */
async function findSession(order: OrderDoc): Promise<Stripe.Checkout.Session | null> {
  if (order.stripeSessionId) return stripe.checkout.sessions.retrieve(order.stripeSessionId);
  if (!order.createdAt) return null;

  const orderId = orderIdFromDocId(order._id);
  const created = Math.floor(new Date(order.createdAt).getTime() / 1000);
  for await (const session of stripe.checkout.sessions.list({
    created: { gte: created - 120, lte: created + 600 },
    limit: 100,
  })) {
    if (session.metadata?.orderId === orderId) return session;
  }
  return null;
}

export interface CleanupSummary {
  checked: number;
  paid: number;
  expired: number;
  cancelled: number;
  errors: number;
}

/**
 * Releases reservations stuck in `pending` (e.g. the server crashed between
 * reserving and creating the Stripe session, a rollback failed, or webhooks
 * were lost in an outage). Asks Stripe what actually happened first, so a
 * paid order is recorded as paid — never released by mistake.
 * Safe to run repeatedly: every step is idempotent.
 */
export async function releaseStaleReservations(now = new Date()): Promise<CleanupSummary> {
  const stale = await getStalePendingOrders(new Date(now.getTime() - STALE_AFTER_MS));
  const summary: CleanupSummary = { checked: stale.length, paid: 0, expired: 0, cancelled: 0, errors: 0 };

  for (const order of stale) {
    const orderId = orderIdFromDocId(order._id);
    try {
      const session = await findSession(order);

      if (!session) {
        // No session was ever created: just give the stock back.
        if (await cancelOrder(orderId)) summary.cancelled++;
        continue;
      }

      if (session.status === 'complete') {
        // Paid (or processing) but the webhook never landed: record it the same way.
        await handleCompleted(session);
        summary.paid++;
        continue;
      }

      if (session.status === 'open') {
        // Shouldn't happen past expires_at, but make sure it can't be paid later.
        await stripe.checkout.sessions.expire(session.id).catch(() => {});
      }
      if (await markExpired(orderId, session.id)) summary.expired++;
    } catch (err) {
      summary.errors++;
      console.error('Cleanup failed for', order._id, err);
    }
  }

  if (summary.checked > 0) console.log('Stale reservation cleanup', summary);
  return summary;
}
