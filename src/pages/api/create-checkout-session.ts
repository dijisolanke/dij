import type { APIRoute } from 'astro';
import { stripe } from '../../lib/stripe';
import { getShopItemBySlug, urlFor } from '../../lib/sanity';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { slug } = await request.json();

  if (!slug || typeof slug !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400 });
  }

  const item = await getShopItemBySlug(slug);

  if (!item) {
    return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 });
  }

  if (item.soldOut) {
    return new Response(JSON.stringify({ error: 'Item is sold out' }), { status: 400 });
  }

  const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;

  // Digital items (tickets) today; physical items will need
  // shipping_address_collection + shipping_options added here later.
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: item.currency || 'usd',
          unit_amount: Math.round(item.price * 100),
          product_data: {
            name: item.title,
            description: item.description,
            images: item.images.slice(0, 1).map((img) => urlFor(img).width(800).height(800).url()),
          },
        },
      },
    ],
    success_url: `${siteUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/shop/${item.slug.current}`,
    metadata: { itemSlug: item.slug.current },
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
