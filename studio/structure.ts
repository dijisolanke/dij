import type { StructureResolver } from "sanity/structure";
import { singletonTypes } from "./schemaTypes";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.listItem()
        .title("About Diji")
        .id("about")
        .child(S.document().schemaType("about").documentId("about")),
      S.listItem()
        .title("Site Settings")
        .id("siteSettings")
        .child(
          S.document().schemaType("siteSettings").documentId("siteSettings"),
        ),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (listItem) => !singletonTypes.has(listItem.getId() as string),
      ),
    ]);
