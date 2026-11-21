import type Stripe from 'stripe';
import { STRIPE_WEBHOOK_SECRET } from 'astro:env/server';
import { stripe, cryptoProvider } from './client';
import {
  markExpired,
  markFailed,
  markPaid,
  markProcessing,
  recordPaidOrder,
  type PaymentDetails,
} from '../orders';

/** Throws if the signature is missing/invalid. Needs the raw, unparsed body. */
export function verifyEvent(rawBody: string, signature: string): Promise<Stripe.Event> {
  return stripe.webhooks.constructEventAsync(
    rawBody,
    signature,
    STRIPE_WEBHOOK_SECRET,
    undefined,
    cryptoProvider,
  );
}

export function paymentDetails(session: Stripe.Checkout.Session): PaymentDetails {
  const shipping = session.collected_information?.shipping_details;
  return {
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    amountSubtotal: session.amount_subtotal ?? undefined,
    amountTotal: session.amount_total ?? undefined,
    currency: session.currency ?? undefined,
    customerName: session.customer_details?.name ?? undefined,
    customerEmail: session.customer_details?.email ?? undefined,
    customerPhone: session.customer_details?.phone ?? undefined,
    shippingAddress: shipping ? { name: shipping.name, ...shipping.address } : undefined,
  };
}

/** Our checkout puts these on every session; used to recreate an order if it's missing. */
function fallbackFrom(session: Stripe.Checkout.Session) {
  const qty = Number(session.metadata?.qty);
  return {
    itemId: session.metadata?.itemId,
    qty: Number.isInteger(qty) && qty > 0 ? qty : 1,
    stockPath: session.metadata?.stockPath,
    kind: session.metadata?.kind,
  };
}

export const isSettled = (session: Stripe.Checkout.Session) =>
  session.payment_status === 'paid' || session.payment_status === 'no_payment_required';

export async function handleCompleted(session: Stripe.Checkout.Session) {
  const details = paymentDetails(session);
  const orderId = session.metadata?.orderId;
  const settled = isSettled(session);

  if (orderId) {
    if (settled) await markPaid(orderId, details, fallbackFrom(session));
    else await markProcessing(orderId, details); // delayed method; wait for async_payment_*
    return;
  }

  // No orderId → not created by our checkout (e.g. a Stripe Payment Link,
  // which must carry metadata.itemId). Keyed by session ID for idempotency.
  const itemId = session.metadata?.itemId;
  if (!itemId) {
    console.warn('checkout.session.completed without orderId/itemId — ignoring', session.id);
    return;
  }
  if (!settled) return; // recorded once async_payment_succeeded arrives
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
  const qty = lineItems.data[0]?.quantity ?? 1;
  await recordPaidOrder(
    session.id,
    itemId,
    qty,
    details,
    { source: 'payment-link', ...(session.metadata?.kind ? { kind: session.metadata.kind } : {}) },
    session.metadata?.stockPath, // set on ticket Payment Links, e.g. ticketTypes[_key=="abc"].stock
  );
}

/**
 * Applies a verified event. Safe to run more than once per event: every
 * transition checks the order's current status under a revision lock.
 * Throws on transient failures so the route returns 5xx and Stripe retries.
 */
export async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCompleted(event.data.object);
      break;

    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      if (session.metadata?.orderId) await markPaid(session.metadata.orderId, paymentDetails(session), fallbackFrom(session));
      else await handleCompleted(session);
      break;
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object;
      if (session.metadata?.orderId) await markFailed(session.metadata.orderId, session.id);
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      if (session.metadata?.orderId) await markExpired(session.metadata.orderId, session.id);
      break;
    }

    default:
      // Not subscribed to anything else; acknowledge so Stripe doesn't retry.
      break;
  }
}
