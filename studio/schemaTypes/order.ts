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
      options: {list: ['pending', 'processing', 'paid', 'expired', 'cancelled', 'failed']},
    }),
    defineField({name: 'item', title: 'Item', type: 'reference', to: [{type: 'shopItem'}], weak: true}),
    defineField({name: 'itemTitle', title: 'Item title (at time of order)', type: 'string'}),
    defineField({name: 'qty', title: 'Quantity', type: 'number'}),
    defineField({
      name: 'amountTotal',
      title: 'Amount paid (pence/cents)',
      type: 'number',
    }),
    defineField({name: 'currency', title: 'Currency', type: 'string'}),
    defineField({
      name: 'amountMismatch',
      title: '⚠️ Amount mismatch',
      type: 'boolean',
      description:
        'True if Stripe charged a different item amount than the site expected. Investigate and refund in Stripe if needed.',
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
    defineField({name: 'stripeSessionId', title: 'Stripe Checkout Session', type: 'string'}),
    defineField({name: 'stripePaymentIntentId', title: 'Stripe Payment', type: 'string'}),
    defineField({name: 'createdAt', title: 'Created', type: 'datetime'}),
    defineField({name: 'updatedAt', title: 'Updated', type: 'datetime'}),
  ],
  orderings: [
    {title: 'Newest first', name: 'createdAtDesc', by: [{field: 'createdAt', direction: 'desc'}]},
  ],
  preview: {
    select: {item: 'itemTitle', qty: 'qty', status: 'status', email: 'customerEmail', createdAt: 'createdAt'},
    prepare: ({item, qty, status, email, createdAt}) => ({
      title: `${item ?? 'Item'} × ${qty ?? 1} — ${status ?? ''}`,
      subtitle: [email, createdAt?.slice(0, 16).replace('T', ' ')].filter(Boolean).join(' · '),
    }),
  },
})
