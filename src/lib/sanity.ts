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
  _type: string;
  asset: { _ref: string; _type: 'reference' };
  hotspot?: { x: number; y: number; width: number; height: number };
}

export function urlFor(source: SanityImage) {
  return builder.image(source);
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface About {
  _id: string;
  name: string;
  heroImage: SanityImage;
  bio: string;
  socialLinks?: SocialLink[];
}

export interface SiteSettings {
  shopEnabled: boolean;
}

export interface Gig {
  _id: string;
  date: string;
  venue: string;
  city: string;
  soldOut?: boolean;
  notes?: string;
}

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  _id: string;
  title: string;
  image?: SanityImage;
  description?: string;
  links?: ProjectLink[];
  quote?: { text?: string; attribution?: string };
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

export type WatchMedia =
  | (SanityImage & { _type: 'mediaImage' })
  | { _type: 'videoUpload'; title?: string; asset: { url: string; mimeType?: string } }
  | { _type: 'videoLink'; title?: string; url: string };

export interface WatchEntry {
  _id: string;
  title?: string;
  body?: string;
  media?: WatchMedia[];
  revealStyle: 'always-visible' | 'tap-to-reveal';
  entryType: 'standard' | 'surprise';
  weight?: number;
}

export async function getAbout(): Promise<About | null> {
  return sanity.fetch(`*[_type == "about"][0]`);
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const settings = await sanity.fetch<SiteSettings | null>(`*[_type == "siteSettings"][0]`);
  return settings ?? { shopEnabled: true };
}

export async function getUpcomingGigs(): Promise<Gig[]> {
  return sanity.fetch(`*[_type == "gig" && date >= now()] | order(date asc)`);
}

export async function getProjects(): Promise<Project[]> {
  return sanity.fetch(`*[_type == "project"] | order(coalesce(weight, 100) asc, _createdAt desc)`);
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

export async function getWatchEntries(): Promise<WatchEntry[]> {
  return sanity.fetch(
    `*[_type == "watchEntry"] | order(coalesce(weight, 100) asc, _createdAt desc) {
      ...,
      media[] {
        ...,
        _type == "videoUpload" => { "asset": asset->{url, mimeType} }
      }
    }`
  );
}
