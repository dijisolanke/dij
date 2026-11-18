import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from 'astro:env/server';

// fetch-based HTTP client so the SDK runs on Cloudflare Workers.
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});

// Used to verify webhook signatures with Web Crypto (no Node crypto on Workers).
export const cryptoProvider = Stripe.createSubtleCryptoProvider();
