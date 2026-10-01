import {defineArrayMember, defineField, defineType} from 'sanity'

export default defineType({
  name: 'watchEntry',
  title: 'Watch Entry',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Optional — leave blank to show the video(s) without a heading.',
    }),
    defineField({
      name: 'body',
      title: 'Body text',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'media',
      title: 'Media',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          name: 'mediaImage',
          title: 'Image',
          options: {hotspot: true},
        }),
        defineArrayMember({
          type: 'file',
          name: 'videoUpload',
          title: 'Uploaded video',
          options: {accept: 'video/*'},
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              description: 'Optional caption shown with this video.',
            }),
          ],
        }),
        defineArrayMember({
          type: 'object',
          name: 'videoLink',
          title: 'Video link (YouTube, Vimeo, etc.)',
          fields: [
            defineField({
              name: 'url',
              title: 'URL',
              type: 'url',
              validation: (Rule) => Rule.required().uri({scheme: ['http', 'https']}),
            }),
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              description: 'Optional caption shown with this video.',
            }),
          ],
          preview: {
            select: {title: 'title', subtitle: 'url'},
            prepare({title, subtitle}) {
              return {title: title || 'Video link', subtitle}
            },
          },
        }),
      ],
      description: 'Mix of images and short videos — videos can be uploaded directly or linked from YouTube/Vimeo/etc.',
    }),
    defineField({
      name: 'revealStyle',
      title: 'Reveal style',
      type: 'string',
      options: {list: ['always-visible', 'tap-to-reveal']},
      initialValue: 'always-visible',
      description: 'Controls how this entry appears on the Watch page — visible immediately, or hidden until tapped.',
    }),
    defineField({
      name: 'entryType',
      title: 'Entry type',
      type: 'string',
      options: {list: ['standard', 'surprise']},
      initialValue: 'standard',
      description:
        'Leave as "standard" for now. "surprise" is reserved for a future prize/easter-egg mechanic — see docs/future-watch-surprise-feature.md before using it.',
    }),
    defineField({
      name: 'weight',
      title: 'Order weight',
      type: 'number',
      description: 'Lower numbers surface first / more often. Optional.',
    }),
  ],
  preview: {
    select: {title: 'title', media: 'media.0'},
    prepare({title, media}) {
      return {title: title || 'Untitled entry', media}
    },
  },
})
