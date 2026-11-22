import { EMAIL_FROM, RESEND_API_KEY } from 'astro:env/server';
import { COMPANY } from '../company';

/**
 * The one place that talks to the email provider (Resend, via its REST API —
 * no SDK, works on any host). Swapping provider later (e.g. Cloudflare Email
 * Service) only means rewriting this function.
 */

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Same key within 24h = Resend sends at most once, even if we call twice. */
  idempotencyKey: string;
}

/** 'sent' also covers "already sent under this key". 'disabled' = no API key configured. */
export type SendResult = 'sent' | 'disabled';

export async function sendEmail(email: Email): Promise<SendResult> {
  if (!RESEND_API_KEY) return 'disabled';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': email.idempotencyKey,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email.to],
      reply_to: COMPANY.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (res.ok) return 'sent';
  // 409 = this key was already used (sent, or being sent by a parallel call).
  if (res.status === 409) return 'sent';
  const detail = await res.text().catch(() => '');
  throw new Error(`Email send failed (${res.status}): ${detail.slice(0, 300)}`);
}
