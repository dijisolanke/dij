import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'about',
  title: 'About Merle',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Artist name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'heroImage',
      title: 'Photo',
      type: 'image',
      options: {hotspot: true},
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'bio',
      title: 'Bio',
      type: 'text',
      rows: 10,
      description: 'Separate paragraphs with a blank line.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'socialLinks',
      title: 'Social links',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'socialLink',
          fields: [
            defineField({
              name: 'platform',
              title: 'Platform',
              type: 'string',
              options: {list: ['Instagram', 'Twitter / X', 'Facebook', 'YouTube', 'Bandcamp', 'Other']},
            }),
            defineField({name: 'url', title: 'URL', type: 'url', validation: (Rule) => Rule.required()}),
          ],
          preview: {
            select: {title: 'platform', subtitle: 'url'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'name', media: 'heroImage'},
  },
})
