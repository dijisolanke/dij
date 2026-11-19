import type Stripe from 'stripe';
import { STRIPE_SHIPPING_RATE_IDS } from 'astro:env/server';
import { stripe } from './client';
import { SHIPPING_COUNTRIES } from './countries';
import { urlFor } from '../sanity';
import { itemCurrency, toMinorUnits, type CheckoutItem } from '../orders';

// Stripe's minimum is 30 minutes from creation; a minute of slack covers
// clock skew / request latency. Expired sessions release reserved stock.
const SESSION_LIFETIME_SECONDS = 31 * 60;

const shippingRateIds = (STRIPE_SHIPPING_RATE_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

export async function createCheckoutSession(opts: {
  item: CheckoutItem;
  qty: number;
  orderId: string;
  siteUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const { item, qty, orderId, siteUrl } = opts;
  const metadata = { orderId, itemId: item._id, qty: String(qty) };
  const isPhysical = item.type === 'physical';

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    client_reference_id: orderId,
    line_items: [
      {
        quantity: qty,
        price_data: {
          currency: itemCurrency(item),
          unit_amount: toMinorUnits(item.price),
          product_data: {
            name: item.title,
            ...(item.description ? { description: item.description.slice(0, 500) } : {}),
            images: (item.images ?? []).slice(0, 1).map((img) => urlFor(img).width(800).height(800).url()),
          },
        },
      },
    ],
    metadata,
    // Also on the PaymentIntent, so it's visible from the Payments list in the dashboard.
    payment_intent_data: { metadata },
    expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
    success_url: `${siteUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/shop/${item.slug.current}`,
  };

  if (isPhysical) {
    params.shipping_address_collection = { allowed_countries: SHIPPING_COUNTRIES };
    params.phone_number_collection = { enabled: true };
    // Optional: with no rate IDs configured, shipping is assumed to be built
    // into the product price and no shipping line is shown.
    if (shippingRateIds.length > 0) {
      params.shipping_options = shippingRateIds.map((shipping_rate) => ({ shipping_rate }));
    }
  }

  // orderId is unique per attempt, so a network retry can't create two sessions.
  return stripe.checkout.sessions.create(params, { idempotencyKey: `checkout-${orderId}` });
}
