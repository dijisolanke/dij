import type { WatchEntry, WatchMedia } from './sanity';

// Used whenever a provider has no thumbnail (Vimeo) or its thumbnails 404
// (confirmed this happens: YouTube doesn't generate maxresdefault for every
// upload). Replace this file any time — no code change needed.
export const FALLBACK_THUMBNAIL = '/video-thumbnail-fallback.svg';

export interface ResolvedEmbed {
  /** Full player, loaded on click (sound on). */
  embedUrl: string;
  /** Muted, chrome-less, looping player shown while hovering the thumbnail. */
  previewUrl: string;
  // First candidate is tried first; on error the next one is tried, and so
  // on. Always ends with FALLBACK_THUMBNAIL so there's always a last resort.
  thumbnailCandidates: string[];
}

function youtubeEmbed(url: string): ResolvedEmbed | null {
  const watch = url.match(/[?&]v=([\w-]{11})/);
  const short = url.match(/youtu\.be\/([\w-]{11})/);
  const shorts = url.match(/youtube\.com\/(?:shorts|embed)\/([\w-]{11})/);
  const id = watch?.[1] || short?.[1] || shorts?.[1];
  if (!id) return null;
  return {
    // youtube-nocookie.com: YouTube's privacy-enhanced mode — no tracking
    // cookies until the visitor actually plays the video (UK PECR).
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    // loop only works on a single video when it's also passed as a playlist.
    previewUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0&disablekb=1&iv_load_policy=3`,
    thumbnailCandidates: [
      `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      FALLBACK_THUMBNAIL,
    ],
  };
}

function vimeoEmbed(url: string): ResolvedEmbed | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (!match) return null;
  return {
    // dnt=1: Vimeo sets no tracking cookies / analytics for this player.
    embedUrl: `https://player.vimeo.com/video/${match[1]}?dnt=1`,
    previewUrl: `https://player.vimeo.com/video/${match[1]}?autoplay=1&muted=1&controls=0&loop=1&dnt=1`,
    thumbnailCandidates: [FALLBACK_THUMBNAIL],
  };
}

export function resolveEmbed(url: string): ResolvedEmbed | null {
  return youtubeEmbed(url) || vimeoEmbed(url);
}

export type VideoMedia = Extract<WatchMedia, { _type: 'videoUpload' | 'videoLink' }>;

export function isPlayableVideo(m: WatchMedia): m is VideoMedia {
  return (m._type === 'videoLink' && !!resolveEmbed(m.url)) || (m._type === 'videoUpload' && !!m.asset?.url);
}

/** First playable video from a standard, always-visible entry, for the
    landing page's Watch section. Tap-to-reveal and surprise entries stay
    on /watch so their mechanics aren't spoiled. */
export function findFeaturedVideo(entries: WatchEntry[]): { video: VideoMedia; entry: WatchEntry } | null {
  for (const entry of entries) {
    if (entry.revealStyle === 'tap-to-reveal' || entry.entryType === 'surprise') continue;
    const video = entry.media?.find(isPlayableVideo);
    if (video) return { video, entry };
  }
  return null;
}
