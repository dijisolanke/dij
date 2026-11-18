import type { APIRoute } from 'astro';
import { STRIPE_WEBHOOK_SECRET } from 'astro:env/server';
import { stripe, cryptoProvider } from '../../lib/stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  let event;
  try {
    // Async variant + SubtleCrypto: Workers has no synchronous Node crypto.
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    return new Response(`Webhook signature verification failed`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // MVP: Stripe's own receipt email covers confirmation. When ticket/merch
    // fulfillment logic is needed, handle it here using session.metadata.itemSlug
    // and session.customer_details.
    console.log('Checkout completed', session.id, session.metadata);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
