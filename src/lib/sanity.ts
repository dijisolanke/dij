import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production';

export const sanity = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  useCdn: true,
});

const builder = imageUrlBuilder(sanity);

export interface SanityImage {
  _type: 'image';
  asset: { _ref: string; _type: 'reference' };
  hotspot?: { x: number; y: number; width: number; height: number };
}

export interface SanityFile {
  _type: string;
  asset: { url: string; mimeType?: string; _ref?: string };
}

export function urlFor(source: SanityImage) {
  return builder.image(source);
}

export interface Show {
  _id: string;
  date: string;
  venue: string;
  city: string;
  ticketPrice?: number;
  currency?: string;
  soldOut?: boolean;
  notes?: string;
}

export interface ShopItem {
  _id: string;
  title: string;
  slug: { current: string };
  description?: string;
  price: number;
  currency: string;
  type: 'digital-ticket' | 'physical';
  images: SanityImage[];
  soldOut?: boolean;
}

export interface BtsEntry {
  _id: string;
  title: string;
  body?: string;
  media?: Array<SanityImage | SanityFile>;
  revealStyle: 'always-visible' | 'tap-to-reveal';
  entryType: 'standard' | 'surprise';
  weight?: number;
}

export async function getUpcomingShows(): Promise<Show[]> {
  return sanity.fetch(
    `*[_type == "show" && date >= now()] | order(date asc)`
  );
}

export async function getShopItems(): Promise<ShopItem[]> {
  return sanity.fetch(`*[_type == "shopItem"] | order(_createdAt desc)`);
}

export async function getShopItemBySlug(slug: string): Promise<ShopItem | null> {
  return sanity.fetch(
    `*[_type == "shopItem" && slug.current == $slug][0]`,
    { slug }
  );
}

export async function getBtsEntries(): Promise<BtsEntry[]> {
  return sanity.fetch(
    `*[_type == "btsEntry"] | order(coalesce(weight, 100) asc, _createdAt desc) {
      ...,
      media[] {
        ...,
        _type == "mediaVideo" => { "asset": asset->{url, mimeType} }
      }
    }`
  );
}
