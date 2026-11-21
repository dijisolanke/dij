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
      // Door list: pick a show you sell tickets for → everyone with a paid
      // ticket (name × quantity — ticket type). Open it on a phone at the door.
      S.listItem()
        .title("Door lists")
        .id("doorLists")
        .child(
          S.documentTypeList("gig")
            .title("Shows with tickets sold here")
            .filter('_type == "gig" && ticketing == "onsite"')
            .defaultOrdering([{ field: "date", direction: "desc" }])
            .child((gigId) =>
              S.documentList()
                .title("Paid tickets")
                .schemaType("order")
                .filter('_type == "order" && kind == "ticket" && status == "paid" && item._ref == $gigId')
                .params({ gigId })
                .defaultOrdering([{ field: "customerName", direction: "asc" }]),
            ),
        ),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (listItem) => !singletonTypes.has(listItem.getId() as string),
      ),
    ]);
