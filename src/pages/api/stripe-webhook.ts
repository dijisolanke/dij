import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { handleEvent, verifyEvent } from '../../lib/stripe/webhook';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  // Raw body is required: the signature is over the exact bytes Stripe sent.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await verifyEvent(body, signature);
  } catch {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // 5xx → Stripe retries with backoff for up to 3 days. Handlers are idempotent.
    console.error('Webhook handling failed', event.type, event.id, err);
    return new Response('Webhook handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
