import { createClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';
import { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } from 'astro:env/client';

const projectId = PUBLIC_SANITY_PROJECT_ID;
const dataset = PUBLIC_SANITY_DATASET;

export const sanity = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  useCdn: true,
});

const builder = createImageUrlBuilder(sanity);

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
  bio?: string;
  heroCta?: { label?: string; url?: string };
}

export interface SiteSettings {
  siteName: string;
  displayName?: string;
  tagline?: string;
  socialLinks?: SocialLink[];
  soundcloudUrl?: string;
  shopEnabled: boolean;
}

export interface TicketType {
  _key: string;
  name: string;
  price: number;
  /** Undefined/null = no limit. */
  stock?: number | null;
  maxPerOrder?: number;
  description?: string;
  soldOut?: boolean;
}

export interface Gig {
  _id: string;
  title?: string;
  date: string;
  venue: string;
  city: string;
  /** Missing on older gigs = 'external'. */
  ticketing?: 'none' | 'external' | 'onsite';
  ticketUrl?: string;
  currency?: string;
  ticketTypes?: TicketType[];
  soldOut?: boolean;
  notes?: string;
}

/** A ticket type that can't be bought right now. */
export const isTicketTypeSoldOut = (t: Pick<TicketType, 'soldOut' | 'stock'>) =>
  t.soldOut === true || (typeof t.stock === 'number' && t.stock <= 0);

/** Every ticket type sold out (or the whole show marked sold out). */
export const isGigSoldOut = (gig: Pick<Gig, 'soldOut' | 'ticketTypes'>) =>
  gig.soldOut === true || (!!gig.ticketTypes?.length && gig.ticketTypes.every(isTicketTypeSoldOut));

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
  /** Units left. Undefined/null = unlimited. */
  stock?: number | null;
  maxPerOrder?: number;
}

/** Manual "Sold out" switch, or tracked stock has run out. */
export const isSoldOut = (item: Pick<ShopItem, 'soldOut' | 'stock'>) =>
  item.soldOut === true || (typeof item.stock === 'number' && item.stock <= 0);

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
  return settings ?? { siteName: 'Diji', shopEnabled: false };
}

export async function getUpcomingGigs(): Promise<Gig[]> {
  return sanity.fetch(`*[_type == "gig" && date >= now()] | order(date asc)`);
}

export async function getProjects(): Promise<Project[]> {
  return sanity.fetch(`*[_type == "project"] | order(coalesce(weight, 100) asc, _createdAt desc)`);
}

/** Merch only — tickets are sold from the gig in the Live section. */
export async function getShopItems(): Promise<ShopItem[]> {
  return sanity.fetch(`*[_type == "shopItem" && type != "digital-ticket"] | order(_createdAt desc)`);
}

export async function getGig(id: string): Promise<Gig | null> {
  return sanity.fetch(`*[_type == "gig" && _id == $id][0]`, { id });
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
