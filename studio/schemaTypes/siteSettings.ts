import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
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
