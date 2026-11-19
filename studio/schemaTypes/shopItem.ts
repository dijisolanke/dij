import {defineField, defineType} from 'sanity'

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
      description: 'Price in whole currency units, e.g. 20 for $20.00',
      validation: (Rule) => Rule.required().positive(),
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
      options: {list: ['digital-ticket', 'physical']},
      initialValue: 'digital-ticket',
      description:
        'digital-ticket = no shipping needed. physical = reserved for future merch drops that require shipping.',
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
