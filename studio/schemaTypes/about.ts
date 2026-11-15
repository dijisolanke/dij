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
      description: "Full-screen background of the landing page hero. Set the hotspot to keep your face in frame on both phones and wide screens.",
      options: { hotspot: true },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "bio",
      title: "Bio",
      type: "text",
      rows: 10,
      description: "Not shown on the page. Used as the description search engines and link previews show.",
    }),
    defineField({
      name: "heroCta",
      title: "Hero button",
      type: "object",
      description: "Optional button under the hero headline (e.g. \"Stream now\"). Hidden unless both fields are filled in.",
      fields: [
        defineField({ name: "label", title: "Label", type: "string" }),
        defineField({ name: "url", title: "URL", type: "url" }),
      ],
    }),
  ],
  preview: {
    select: { title: "name", media: "heroImage" },
  },
});
