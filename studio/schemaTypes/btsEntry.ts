import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'btsEntry',
  title: 'BTS Entry',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
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
        {type: 'image', options: {hotspot: true}, name: 'mediaImage', title: 'Image'},
        {
          type: 'file',
          name: 'mediaVideo',
          title: 'Video',
          options: {accept: 'video/*'},
        },
      ],
      description: 'Mix of images and short video files, shown in order.',
    }),
    defineField({
      name: 'revealStyle',
      title: 'Reveal style',
      type: 'string',
      options: {list: ['always-visible', 'tap-to-reveal']},
      initialValue: 'always-visible',
      description: 'Controls how this entry appears on the BTS page — visible immediately, or hidden until tapped.',
    }),
    defineField({
      name: 'entryType',
      title: 'Entry type',
      type: 'string',
      options: {list: ['standard', 'surprise']},
      initialValue: 'standard',
      description:
        'Leave as "standard" for now. "surprise" is reserved for a future prize/easter-egg mechanic — see docs/future-bts-surprise-feature.md before using it.',
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
  },
})
