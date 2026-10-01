import { defineField, defineType } from "sanity";

export default defineType({
  name: "about",
  title: "About Diji",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Artist name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "heroImage",
      title: "Photo",
      type: "image",
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "text",
      rows: 10,
      description: "Separate paragraphs with a blank line.",
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { title: "name", media: "heroImage" },
  },
});
