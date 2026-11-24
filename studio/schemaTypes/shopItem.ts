import {defineField, defineType} from 'sanity'
import {minPriceCheck} from './minPrice'

export default defineType({
  name: 'shopItem',
  title: 'Shop Item',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'price',
      title: 'Price',
      type: 'number',
      description: 'e.g. 20 for £20.00. Include delivery (it\'s built into the price). Minimum £0.30 / $0.50 / €0.50.',
      validation: (Rule) =>
        Rule.required()
          .precision(2)
          .custom((price, context) => minPriceCheck(price, (context.parent as {currency?: string})?.currency)),
    }),
    defineField({
      name: 'currency',
      title: 'Currency',
      type: 'string',
      initialValue: 'gbp',
      options: {list: ['gbp', 'usd', 'eur']},
    }),
    defineField({
      name: 'stock',
      title: 'Stock',
      type: 'number',
      description:
        'Units available. Leave empty for unlimited. Goes down automatically when someone starts checkout, and comes back if they abandon it (after 30 min).',
      validation: (Rule) => Rule.integer().min(0),
    }),
    defineField({
      name: 'maxPerOrder',
      title: 'Max per order',
      type: 'number',
      initialValue: 4,
      description: 'Most units one customer can buy in a single checkout.',
      validation: (Rule) => Rule.integer().min(1).max(20),
    }),
    defineField({
      name: 'type',
      title: 'Item type',
      type: 'string',
      options: {
        list: [
          {title: 'Physical merch (shipped)', value: 'physical'},
          {title: 'Ticket (old — no longer sold in the shop)', value: 'digital-ticket'},
        ],
      },
      initialValue: 'physical',
      description:
        'Show tickets are now set up on the Gig itself (Gig → Tickets → "Sold on this site"). Items marked "Ticket" are hidden from the shop.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      of: [{type: 'image', options: {hotspot: true}}],
      validation: (Rule) => Rule.required().min(2).max(5),
      description: 'Between 2 and 5 images per item.',
    }),
    defineField({
      name: 'soldOut',
      title: 'Sold out',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: {title: 'title', media: 'images.0'},
  },
})
