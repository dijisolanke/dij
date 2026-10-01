import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'siteName',
      title: 'Site name',
      type: 'string',
      description: 'Shown at the top of the menu sidebar on every page.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tagline',
      title: 'Tagline',
      type: 'string',
      description: 'Shown under the site name in the sidebar, e.g. "Freelance Musician & Composer".',
    }),
    defineField({
      name: 'socialLinks',
      title: 'Social links',
      type: 'array',
      description: 'Shown at the bottom of the sidebar on every page.',
      of: [
        {
          type: 'object',
          name: 'socialLink',
          fields: [
            defineField({
              name: 'platform',
              title: 'Platform',
              type: 'string',
              options: {
                list: ['Instagram', 'Twitter / X', 'Facebook', 'YouTube', 'Bandcamp', 'Soundcloud', 'Other'],
              },
              validation: (Rule) => Rule.required(),
            }),
            defineField({name: 'url', title: 'URL', type: 'url', validation: (Rule) => Rule.required()}),
          ],
          preview: {
            select: {title: 'platform', subtitle: 'url'},
          },
        },
      ],
    }),
    defineField({
      name: 'shopEnabled',
      title: 'Shop enabled',
      type: 'boolean',
      initialValue: true,
      description:
        'Turn off to keep "Shop" visible in the menu while making it unclickable — use this before the shop is ready to go live.',
    }),
  ],
})
