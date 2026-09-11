import type { APIRoute } from 'astro';
import { stripe } from '../../lib/stripe';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      import.meta.env.STRIPE_WEBHOOK_SECRET
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
