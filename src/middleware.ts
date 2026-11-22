import { defineMiddleware } from 'astro:middleware';

/**
 * Security headers for every server-rendered page and API response.
 * Kept deliberately conservative so nothing on the site breaks (YouTube/Vimeo
 * embeds, Sanity images, Turnstile, inline Astro scripts). A full
 * Content-Security-Policy can be layered on later.
 */
const SECURITY_HEADERS: Record<string, string> = {
  // Always HTTPS once a browser has seen the site (ignored on http://localhost).
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  // Don't let other sites put our pages in an iframe (clickjacking the Buy button).
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
};

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  return response;
});
