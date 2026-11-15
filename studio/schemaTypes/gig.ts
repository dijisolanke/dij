import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'gig',
  title: 'Gig',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Event / act name',
      type: 'string',
      description: 'Optional headline shown above the date, e.g. "DIY Ceilidh — Saltburn Folk Festival". Leave blank to just show the venue.',
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'venue',
      title: 'Venue',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'city',
      title: 'City',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'ticketUrl',
      title: 'Ticket link',
      type: 'url',
      description: 'Shows a "Tickets" button on the listing. Ignored while the gig is marked sold out.',
    }),
    defineField({
      name: 'soldOut',
      title: 'Sold out',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 2,
      description: 'Optional extra info shown under the listing (e.g. "all ages", "doors 7pm")',
    }),
  ],
  preview: {
    select: {title: 'title', venue: 'venue', subtitle: 'city', date: 'date'},
    prepare({title, venue, subtitle, date}) {
      const formatted = date ? new Date(date).toLocaleDateString() : 'No date'
      return {title: `${formatted} — ${title || venue}`, subtitle}
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
