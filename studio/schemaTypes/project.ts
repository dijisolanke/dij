import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 5,
    }),
    defineField({
      name: 'links',
      title: 'Links',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'link',
          fields: [
            defineField({name: 'label', title: 'Label', type: 'string', validation: (Rule) => Rule.required()}),
            defineField({name: 'url', title: 'URL', type: 'url', validation: (Rule) => Rule.required()}),
          ],
          preview: {
            select: {title: 'label', subtitle: 'url'},
          },
        },
      ],
      description: 'e.g. Bandcamp, a YouTube video, an album shop',
    }),
    defineField({
      name: 'quote',
      title: 'Quote',
      type: 'object',
      description: 'Optional testimonial about this project.',
      fields: [
        defineField({name: 'text', title: 'Quote text', type: 'text', rows: 2}),
        defineField({name: 'attribution', title: 'Attributed to', type: 'string'}),
      ],
    }),
    defineField({
      name: 'weight',
      title: 'Order weight',
      type: 'number',
      description: 'Lower numbers appear first. Optional.',
    }),
  ],
  preview: {
    select: {title: 'title', media: 'image'},
  },
  orderings: [
    {
      title: 'Order weight',
      name: 'weightAsc',
      by: [{field: 'weight', direction: 'asc'}],
    },
  ],
})
