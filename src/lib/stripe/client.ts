import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from 'astro:env/server';

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  // Pinned so a Stripe-side default change can't silently alter behaviour.
  // Bump deliberately (and re-test) when upgrading the SDK.
  apiVersion: '2026-08-26.dahlia',
  // fetch-based HTTP client so the SDK runs on Cloudflare Workers.
  httpClient: Stripe.createFetchHttpClient(),
  maxNetworkRetries: 2,
});

// Verifies webhook signatures with Web Crypto (Workers has no Node crypto).
export const cryptoProvider = Stripe.createSubtleCryptoProvider();
