import {defineField, defineType} from 'sanity'

// Written only by the site's checkout + Stripe webhook. Read-only here so
// edits in the Studio can't drift from what Stripe recorded. Refunds etc.
// are done in the Stripe dashboard.
export default defineType({
  name: 'order',
  title: 'Order',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {list: ['pending', 'processing', 'paid', 'expired', 'cancelled', 'failed', 'refunded']},
    }),
    defineField({
      name: 'kind',
      title: 'Type',
      type: 'string',
      options: {list: [{title: 'Merch', value: 'merch'}, {title: 'Ticket', value: 'ticket'}]},
    }),
    defineField({
      name: 'item',
      title: 'Item / gig',
      type: 'reference',
      to: [{type: 'shopItem'}, {type: 'gig'}],
      weak: true,
    }),
    defineField({name: 'itemTitle', title: 'Item title (at time of order)', type: 'string'}),
    defineField({name: 'ticketTypeName', title: 'Ticket type', type: 'string', hidden: ({document}) => document?.kind !== 'ticket'}),
    defineField({name: 'eventDate', title: 'Event date', type: 'datetime', hidden: ({document}) => document?.kind !== 'ticket'}),
    defineField({name: 'qty', title: 'Quantity', type: 'number'}),
    defineField({
      name: 'amountTotal',
      title: 'Amount paid (pence/cents)',
      type: 'number',
    }),
    defineField({name: 'currency', title: 'Currency', type: 'string'}),
    defineField({
      name: 'partiallyRefunded',
      title: 'Partly refunded',
      type: 'boolean',
      description: 'Some of this order was refunded in Stripe. Check the door list / stock if needed.',
    }),
    defineField({name: 'amountRefunded', title: 'Amount refunded (pence/cents)', type: 'number'}),
    defineField({name: 'refundedAt', title: 'Refunded', type: 'datetime'}),
    defineField({
      name: 'amountMismatch',
      title: '⚠️ Amount mismatch',
      type: 'boolean',
      description:
        'True if Stripe charged a different item amount than the site expected. Investigate and refund in Stripe if needed.',
    }),
    defineField({
      name: 'paidAfterRelease',
      title: '⚠️ Paid after release',
      type: 'boolean',
      description:
        'Payment arrived after this order had been released (e.g. delayed webhooks during an outage). Stock was re-taken and may be negative — check you can fulfil it, or refund.',
    }),
    defineField({
      name: 'orderMissing',
      title: '⚠️ Recreated from payment',
      type: 'boolean',
      description: 'Stripe reported a payment for an order that did not exist, so it was recreated. Review it.',
    }),
    defineField({name: 'expectedAmount', title: 'Expected item amount (pence/cents)', type: 'number'}),
    defineField({name: 'expectedCurrency', title: 'Expected currency', type: 'string'}),
    defineField({name: 'amountSubtotal', title: 'Items subtotal charged (pence/cents)', type: 'number'}),
    defineField({name: 'customerName', title: 'Customer name', type: 'string'}),
    defineField({name: 'customerEmail', title: 'Customer email', type: 'string'}),
    defineField({name: 'customerPhone', title: 'Customer phone', type: 'string'}),
    defineField({
      name: 'shippingAddress',
      title: 'Shipping address',
      type: 'object',
      fields: [
        {name: 'name', type: 'string'},
        {name: 'line1', type: 'string'},
        {name: 'line2', type: 'string'},
        {name: 'city', type: 'string'},
        {name: 'state', type: 'string'},
        {name: 'postal_code', title: 'Postcode', type: 'string'},
        {name: 'country', type: 'string'},
      ],
    }),
    defineField({
      name: 'source',
      title: 'Source',
      type: 'string',
      options: {list: ['site', 'payment-link']},
    }),
    defineField({name: 'stockReserved', title: 'Stock reserved', type: 'boolean'}),
    // Technical: where on the item document the stock count lives.
    defineField({name: 'stockPath', title: 'Stock field (technical)', type: 'string', hidden: true}),
    defineField({name: 'ticketTypeKey', title: 'Ticket type key (technical)', type: 'string', hidden: true}),
    defineField({name: 'stripeSessionId', title: 'Stripe Checkout Session', type: 'string'}),
    defineField({name: 'stripePaymentIntentId', title: 'Stripe Payment', type: 'string'}),
    defineField({name: 'createdAt', title: 'Created', type: 'datetime'}),
    defineField({name: 'updatedAt', title: 'Updated', type: 'datetime'}),
  ],
  orderings: [
    {title: 'Newest first', name: 'createdAtDesc', by: [{field: 'createdAt', direction: 'desc'}]},
  ],
  preview: {
    select: {
      item: 'itemTitle',
      qty: 'qty',
      status: 'status',
      kind: 'kind',
      ticketType: 'ticketTypeName',
      name: 'customerName',
      email: 'customerEmail',
      createdAt: 'createdAt',
    },
    prepare: ({item, qty, status, kind, ticketType, name, email, createdAt}) =>
      kind === 'ticket'
        ? {
            // Door-list friendly: who, how many, which ticket.
            title: `${name ?? email ?? 'Guest'} × ${qty ?? 1} — ${ticketType ?? 'Ticket'}`,
            subtitle: [status, item, email].filter(Boolean).join(' · '),
          }
        : {
            title: `${item ?? 'Item'} × ${qty ?? 1} — ${status ?? ''}`,
            subtitle: [email, createdAt?.slice(0, 16).replace('T', ' ')].filter(Boolean).join(' · '),
          },
  },
})
