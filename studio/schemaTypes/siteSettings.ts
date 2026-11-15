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
      description: 'Shown in the header once visitors scroll past the hero, and in the footer.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'displayName',
      title: 'Display name',
      type: 'string',
      description:
        'Short name shown as the header logo, e.g. "Diji". Defaults to "Diji" when empty. The full site name is still used for the browser tab and footer.',
    }),
    defineField({
      name: 'tagline',
      title: 'Tagline',
      type: 'string',
      description: 'Not currently shown on the site.',
    }),
    defineField({
      name: 'socialLinks',
      title: 'Social links',
      type: 'array',
      description: 'Shown in the header and in the "Get Updates" section.',
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
                list: ['Instagram', 'TikTok', 'Twitter / X', 'Facebook', 'YouTube', 'Spotify', 'Bandcamp', 'Soundcloud', 'Other'],
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
      name: 'soundcloudUrl',
      title: 'SoundCloud link',
      type: 'url',
      description:
        'Track, playlist or profile link for the Music section, e.g. https://soundcloud.com/artist/sets/album. Copy it from the browser address bar on SoundCloud.',
      validation: (Rule) =>
        Rule.custom((value) =>
          !value || /^https:\/\/(www\.|on\.|m\.)?soundcloud\.com\//i.test(value as string)
            ? true
            : 'Must be a soundcloud.com link',
        ),
    }),
    defineField({
      name: 'shopEnabled',
      title: 'Shop enabled',
      type: 'boolean',
      initialValue: true,
      description:
        'Turn off to show "Coming soon" in the Shop section and menu, and block checkout — use this before the shop is ready to go live.',
    }),
  ],
})
