import { PUBLIC_SITE_URL } from 'astro:env/server';
import { sanityWrite } from '../sanity-write';
import { COMPANY, TICKET_REFUND_DAYS } from '../company';
import { orderDocId } from '../orders';
import { sendEmail } from './send';

/**
 * Order confirmation emails.
 *
 * Sent once per paid order, from the Stripe webhook straight after the order is
 * recorded. If that fails (provider down, not configured yet…), the scheduled
 * job every 15 minutes retries any paid order from the last couple of days that
 * has no `confirmationSentAt`. Duplicates are prevented twice over: the order
 * records when its email went out, and Resend ignores a repeated idempotency key.
 */

/** How far back the scheduled retry looks. Older orders never get emailed automatically. */
const RETRY_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

interface ConfirmationOrder {
  _id: string;
  status: string;
  kind?: 'merch' | 'ticket';
  itemTitle?: string;
  ticketTypeName?: string;
  eventDate?: string;
  qty?: number;
  amountTotal?: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  confirmationSentAt?: string;
  gig?: { title?: string; venue?: string; city?: string; date?: string; notes?: string } | null;
}

const ORDER_PROJECTION = `{
  _id, status, kind, itemTitle, ticketTypeName, eventDate, qty, amountTotal, currency,
  customerName, customerEmail, shippingAddress, confirmationSentAt,
  "gig": select(item->_type == "gig" => item->{title, venue, city, date, notes})
}`;

/**
 * Sends the confirmation for one order if it's paid and hasn't had one yet.
 * Returns true if an email was sent now. Throws on provider/network errors.
 */
export async function sendOrderConfirmation(orderId: string): Promise<boolean> {
  const order = await sanityWrite.fetch<ConfirmationOrder | null>(
    `*[_id == $id][0]${ORDER_PROJECTION}`,
    { id: orderDocId(orderId) },
  );
  if (!order || order.status !== 'paid' || !order.customerEmail || order.confirmationSentAt) return false;

  const result = await sendEmail({
    to: order.customerEmail,
    ...buildConfirmation(orderId, order),
    idempotencyKey: `order-confirmation/${orderId}`,
  });
  if (result === 'disabled') return false;

  await sanityWrite.patch(order._id).set({ confirmationSentAt: new Date().toISOString() }).commit();
  return true;
}

/** For the webhook: never let an email problem fail the payment handling. */
export async function sendOrderConfirmationQuietly(orderId: string): Promise<void> {
  try {
    await sendOrderConfirmation(orderId);
  } catch (err) {
    console.error('Order confirmation email failed — the scheduled job will retry', orderId, err);
  }
}

/** For the scheduled job: retries recent paid orders whose email didn't go out. */
export async function sendPendingConfirmations(now = new Date()): Promise<{ sent: number; errors: number }> {
  const ids = await sanityWrite.fetch<string[]>(
    `*[_type == "order" && status == "paid" && defined(customerEmail) && !defined(confirmationSentAt)
      && createdAt > $since] | order(createdAt asc)[0...10]._id`,
    { since: new Date(now.getTime() - RETRY_WINDOW_MS).toISOString() },
  );
  const summary = { sent: 0, errors: 0 };
  for (const id of ids) {
    try {
      if (await sendOrderConfirmation(id.replace(/^orders\./, ''))) summary.sent++;
    } catch (err) {
      summary.errors++;
      console.error('Order confirmation retry failed', id, err);
    }
  }
  if (summary.sent || summary.errors) console.log('Order confirmation retries', summary);
  return summary;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Short reference shown to customers (matches the success page). */
export function orderReference(orderId: string): string {
  // Payment Link orders are keyed by the Stripe session ID (cs_…); use its tail.
  const ref = orderId.startsWith('cs_') ? orderId.slice(-8) : orderId.slice(0, 8);
  return ref.toUpperCase();
}

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function money(minor: number | undefined, currency: string | undefined) {
  if (minor == null || !currency) return undefined;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100);
}

function countryName(code?: string) {
  if (!code) return undefined;
  try {
    return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function eventWhen(iso?: string) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

type Row = [label: string, value: string | undefined];

export function buildConfirmation(orderId: string, order: ConfirmationOrder): { subject: string; html: string; text: string } {
  const site = (PUBLIC_SITE_URL || 'https://dijiofficial.com').replace(/\/$/, '');
  const ref = orderReference(orderId);
  const firstName = order.customerName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const qty = order.qty ?? 1;
  const total = money(order.amountTotal, order.currency);
  const isTicket = order.kind === 'ticket';

  let subject: string;
  let intro: string[];
  let rows: Row[];
  let after: string[];

  if (isTicket) {
    const eventName = order.gig?.title || order.gig?.venue || order.itemTitle || 'the show';
    const where = [order.gig?.venue, order.gig?.city].filter(Boolean).join(', ');
    subject = `You're on the list — ${eventName}`;
    intro = [
      `Thanks for your order. ${qty > 1 ? `Your ${qty} tickets are` : 'Your ticket is'} confirmed and ` +
        `${order.customerName ? `the name ${order.customerName} is` : 'your name is'} on the door list.`,
    ];
    rows = [
      ['Show', eventName],
      ['When', eventWhen(order.gig?.date ?? order.eventDate)],
      ['Where', where || undefined],
      ['Tickets', `${qty} × ${order.ticketTypeName ?? 'Ticket'}`],
      ['Total paid', total],
      ['Order reference', ref],
    ];
    after = [
      'At the door: give your name — bring this email or the card you paid with. Age limits and entry rules for this show are on the ticket page, and you may be asked for ID.',
      `Can't make it? You can get a full refund if you ask at least ${TICKET_REFUND_DAYS} days before the show — just reply to this email with your order reference.`,
      ...(order.gig?.notes ? [order.gig.notes] : []),
    ];
  } else {
    const a = order.shippingAddress;
    const address = a
      ? [a.name, a.line1, a.line2, a.city, a.state, a.postal_code, countryName(a.country)].filter(Boolean).join(', ')
      : undefined;
    subject = `Order confirmed — ${order.itemTitle ?? 'your order'}`;
    intro = ["Thanks for your order — it's confirmed. We'll email you again when it's on its way."];
    rows = [
      ['Item', `${qty} × ${order.itemTitle ?? 'Item'}`],
      ['Total paid', total ? `${total} (including delivery)` : undefined],
      ['Delivering to', address],
      ['Order reference', ref],
    ];
    after = [
      'We dispatch orders within 30 days. Orders outside the UK may have import duties to pay on arrival.',
      'Changed your mind? You can cancel within 14 days of receiving your order — reply to this email. Return postage is paid by you.',
    ];
  }

  const shownRows = rows.filter((r): r is [string, string] => !!r[1]);
  const terms = `${site}/legal/terms`;
  const companyLine = `${COMPANY.registeredName} · Registered in ${COMPANY.registeredIn}, company no. ${COMPANY.registeredNumber} · Registered office: ${COMPANY.registeredOffice}`;

  const text = [
    greeting,
    '',
    ...intro,
    '',
    ...shownRows.map(([k, v]) => `${k}: ${v}`),
    '',
    ...after.flatMap((p) => [p, '']),
    `Questions? Just reply to this email or write to ${COMPANY.email}.`,
    `Terms of sale: ${terms}`,
    '',
    '—',
    companyLine,
  ].join('\n');

  const p = (s: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#111111;">${esc(s)}</p>`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;">
<span style="display:none;max-height:0;overflow:hidden;">${esc(intro[0])}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;">
<tr><td style="background:#000000;padding:20px 24px;">
<a href="${esc(site)}" style="color:#ffffff;text-decoration:none;font-size:22px;font-weight:900;letter-spacing:0.08em;">DIJI</a>
</td></tr>
<tr><td style="padding:28px 24px 8px;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.25;text-transform:uppercase;color:#000000;">${esc(subject)}</h1>
${p(greeting)}
${intro.map(p).join('\n')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-top:1px solid #e5e5e5;">
${shownRows
  .map(
    ([k, v]) => `<tr>
<td style="padding:10px 12px 10px 0;border-bottom:1px solid #e5e5e5;font-size:14px;color:#666666;vertical-align:top;white-space:nowrap;">${esc(k)}</td>
<td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-size:15px;color:#111111;font-weight:bold;">${esc(v)}</td>
</tr>`,
  )
  .join('\n')}
</table>
${after.map(p).join('\n')}
<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#111111;">Questions? Just reply to this email or write to <a href="mailto:${esc(COMPANY.email)}" style="color:#111111;">${esc(COMPANY.email)}</a>.</p>
</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.5;color:#777777;">
<a href="${esc(terms)}" style="color:#777777;">Terms of sale</a> · <a href="${esc(site)}/legal/privacy" style="color:#777777;">Privacy</a><br>
${esc(companyLine)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
