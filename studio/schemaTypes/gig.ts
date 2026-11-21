import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'gig',
  title: 'Gig',
  type: 'document',
  groups: [
    {name: 'details', title: 'Details', default: true},
    {name: 'tickets', title: 'Tickets'},
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Event / act name',
      type: 'string',
      group: 'details',
      description: 'Optional headline shown above the date, e.g. "DIY Ceilidh — Saltburn Folk Festival". Leave blank to just show the venue.',
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'datetime',
      group: 'details',
      description: 'Doors / start time. Online ticket sales close at this time.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'venue',
      title: 'Venue',
      type: 'string',
      group: 'details',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'city',
      title: 'City',
      type: 'string',
      group: 'details',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 2,
      group: 'details',
      description: 'Optional extra info shown under the listing (e.g. "all ages", "doors 7pm")',
    }),

    // ---------------- Tickets ----------------
    defineField({
      name: 'ticketing',
      title: 'How are tickets sold?',
      type: 'string',
      group: 'tickets',
      options: {
        list: [
          {title: 'No tickets button', value: 'none'},
          {title: 'Link to another ticket site (someone else runs the show)', value: 'external'},
          {title: 'Sold on this site (my own show)', value: 'onsite'},
        ],
        layout: 'radio',
      },
      initialValue: 'external',
    }),
    defineField({
      name: 'ticketUrl',
      title: 'Ticket link',
      type: 'url',
      group: 'tickets',
      description: 'The other ticket site, e.g. a Dice, Skiddle or venue page.',
      // Older gigs have no "ticketing" value yet: treat them as external.
      hidden: ({document}) => (document?.ticketing ?? 'external') !== 'external',
    }),
    defineField({
      name: 'currency',
      title: 'Ticket currency',
      type: 'string',
      group: 'tickets',
      options: {list: ['gbp', 'usd', 'eur']},
      initialValue: 'gbp',
      hidden: ({document}) => document?.ticketing !== 'onsite',
    }),
    defineField({
      name: 'ticketTypes',
      title: 'Ticket types',
      type: 'array',
      group: 'tickets',
      description:
        'One row per ticket type (e.g. Early bird, Standard, VIP). "Available" goes down automatically as people buy, and comes back if they abandon checkout.',
      hidden: ({document}) => document?.ticketing !== 'onsite',
      validation: (Rule) =>
        Rule.custom((types, context) =>
          context.document?.ticketing === 'onsite' && (!Array.isArray(types) || types.length === 0)
            ? 'Add at least one ticket type to sell tickets on this site'
            : true,
        ),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'ticketType',
          fields: [
            defineField({
              name: 'name',
              title: 'Name',
              type: 'string',
              description: 'e.g. "Early bird", "Standard", "VIP"',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'price',
              title: 'Price',
              type: 'number',
              description: 'In whole currency units, e.g. 12.5 for £12.50',
              validation: (Rule) => Rule.required().positive(),
            }),
            defineField({
              name: 'stock',
              title: 'Available',
              type: 'number',
              description: 'How many are left to sell. Leave empty for no limit.',
              validation: (Rule) => Rule.integer().min(0),
            }),
            defineField({
              name: 'maxPerOrder',
              title: 'Max per order',
              type: 'number',
              initialValue: 6,
              validation: (Rule) => Rule.integer().min(1).max(20),
            }),
            defineField({
              name: 'description',
              title: 'Description',
              type: 'string',
              description: 'Optional, e.g. "Includes a drink" or "First 50 only"',
            }),
            defineField({
              name: 'soldOut',
              title: 'Stop selling this type',
              type: 'boolean',
              initialValue: false,
              description: 'Shows "Sold out" even if some are still available.',
            }),
          ],
          preview: {
            select: {name: 'name', price: 'price', stock: 'stock', soldOut: 'soldOut'},
            prepare: ({name, price, stock, soldOut}) => ({
              title: `${name ?? 'Ticket'} — ${price != null ? price.toFixed(2) : '?'}`,
              subtitle: soldOut ? 'Stopped' : stock == null ? 'No limit' : `${stock} available`,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'soldOut',
      title: 'Whole show sold out',
      type: 'boolean',
      group: 'tickets',
      initialValue: false,
      description: 'Shows "Sold out" on the listing and stops all ticket sales for this gig.',
    }),
  ],
  preview: {
    select: {title: 'title', venue: 'venue', subtitle: 'city', date: 'date', ticketing: 'ticketing'},
    prepare({title, venue, subtitle, date, ticketing}) {
      const formatted = date ? new Date(date).toLocaleDateString() : 'No date'
      const tag = ticketing === 'onsite' ? ' · tickets on site' : ''
      return {title: `${formatted} — ${title || venue}`, subtitle: `${subtitle ?? ''}${tag}`}
    },
  },
  orderings: [
    {
      title: 'Date, soonest first',
      name: 'dateAsc',
      by: [{field: 'date', direction: 'asc'}],
    },
  ],
})
