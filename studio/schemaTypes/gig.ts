import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'gig',
  title: 'Gig',
  type: 'document',
  fields: [
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
    select: {title: 'venue', subtitle: 'city', date: 'date'},
    prepare({title, subtitle, date}) {
      const formatted = date ? new Date(date).toLocaleDateString() : 'No date'
      return {title: `${formatted} — ${title}`, subtitle}
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
