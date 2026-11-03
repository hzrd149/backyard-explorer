import type { NostrEvent } from "nostr-tools";
import {
  getFileMetadata,
  getMediaAttachments,
  getPicturePostAttachments,
  getSha256FromURL,
  type FileMetadataFields,
} from "applesauce-common/helpers";
import { isImageURL, isVideoURL } from "applesauce-core/helpers";
import { isBlossomProxiedUrl, transformBlossomUrl } from "./BlossomService";

/** A resolved image ready to be displayed inline or in the lightbox */
export interface MediaItem {
  /** Full resolution URL */
  url: string;
  /** Smaller preview URL from the imeta `thumb` (or `image`) field */
  thumbnail?: string;
  alt?: string;
  dimensions?: string;
  blurhash?: string;
  /** True when the full URL is served through the local Blossom proxy */
  proxied: boolean;
  /** Media type, defaults to "image" when unset */
  kind?: "image" | "video";
}

/** A media item along with the event it came from */
export interface EventMediaItem extends MediaItem {
  event: NostrEvent;
}

/**
 * Find the imeta attachment that describes a URL found in event content.
 * Matches on the exact URL first, then on the sha256 hash in the URL path.
 */
export function findAttachmentForUrl(
  attachments: FileMetadataFields[] | undefined,
  url: string,
): FileMetadataFields | undefined {
  if (!attachments?.length) return undefined;

  const exact = attachments.find((a) => a.url === url);
  if (exact) return exact;

  const hash = getSha256FromURL(url);
  if (!hash) return undefined;
  return attachments.find(
    (a) => a.sha256 === hash || (a.url && getSha256FromURL(a.url) === hash),
  );
}

/** Pass a URL through the Blossom proxy when one is configured */
function proxy(
  url: string | undefined,
  pubkey?: string,
  meta?: { sha256?: string; type?: string },
): string | undefined {
  if (!url && !meta?.sha256) return undefined;
  return (
    transformBlossomUrl(url ?? null, { ...meta, pubkey }) ?? url ?? undefined
  );
}

/**
 * Build a {@link MediaItem} from a URL and its (optional) imeta attachment.
 * Returns undefined when no URL can be resolved.
 */
export function resolveMediaItem(
  url: string | undefined,
  attachment: FileMetadataFields | undefined,
  pubkey?: string,
): MediaItem | undefined {
  const full = proxy(url ?? attachment?.url, pubkey, {
    sha256: attachment?.sha256,
    type: attachment?.type,
  });
  if (!full) return undefined;

  const thumbSource = attachment?.thumbnail || attachment?.image;
  const thumbnail = thumbSource ? proxy(thumbSource, pubkey) : undefined;

  return {
    url: full,
    thumbnail: thumbnail && thumbnail !== full ? thumbnail : undefined,
    alt: attachment?.alt || attachment?.summary,
    dimensions: attachment?.dimensions,
    blurhash: attachment?.blurhash,
    proxied: isBlossomProxiedUrl(full),
    kind: mediaKind(attachment?.type, url ?? attachment?.url),
  };
}

/** Classify a MIME type / URL as image or video (undefined when neither) */
function mediaKind(
  type: string | undefined,
  url: string | undefined,
): "image" | "video" | undefined {
  if (type?.startsWith("image/")) return "image";
  if (type?.startsWith("video/")) return "video";
  if (url && isVideoURL(url)) return "video";
  if (url && isImageURL(url)) return "image";
  return undefined;
}

/**
 * Resolve the images of a NIP-68 picture post. Attachments without a URL fall
 * back to the matching x/m tags so they can be built from the hash.
 */
export function getPicturePostMedia(event: NostrEvent): MediaItem[] {
  const hashTags = event.tags
    .filter((t) => t[0] === "x" && t[1])
    .map((t) => t[1]);
  const mimeTags = event.tags
    .filter((t) => t[0] === "m" && t[1])
    .map((t) => t[1]);

  return getPicturePostAttachments(event)
    .map((attachment, index) =>
      resolveMediaItem(
        attachment.url,
        {
          ...attachment,
          sha256: attachment.sha256 || hashTags[index] || undefined,
          type: attachment.type || mimeTags[index] || undefined,
        },
        event.pubkey,
      ),
    )
    .filter((item): item is MediaItem => !!item)
    .map((item) => ({ ...item, kind: item.kind ?? "image" }));
}

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

/**
 * Extract every displayable image and video from an event: picture posts,
 * NIP-94 file metadata, NIP-71 videos, and imeta tags / media URLs in content.
 */
export function extractEventMedia(event: NostrEvent): EventMediaItem[] {
  let items: MediaItem[] = [];

  if (event.kind === 20) {
    items = getPicturePostMedia(event);
  } else if (event.kind === 1063) {
    const metadata = getFileMetadata(event);
    const item =
      metadata && resolveMediaItem(metadata.url, metadata, event.pubkey);
    if (item) items = [item];
  } else {
    const attachments = getMediaAttachments(event);
    const seen = new Set<string>();

    // URLs mentioned in the content, paired with their imeta attachment
    for (const url of event.content.match(URL_REGEX) ?? []) {
      if (!isImageURL(url) && !isVideoURL(url)) continue;
      const attachment = findAttachmentForUrl(attachments, url);
      const item = resolveMediaItem(url, attachment, event.pubkey);
      if (item && !seen.has(item.url)) {
        seen.add(item.url);
        items.push(item);
      }
    }

    // imeta attachments that are not referenced in the content (e.g. NIP-71)
    for (const attachment of attachments) {
      if (attachment.url && seen.has(attachment.url)) continue;
      const item = resolveMediaItem(attachment.url, attachment, event.pubkey);
      if (item && !seen.has(item.url)) {
        seen.add(item.url);
        items.push(item);
      }
    }

    // NIP-71 videos without a type hint are still videos
    if (
      event.kind === 21 ||
      event.kind === 22 ||
      event.kind === 34235 ||
      event.kind === 34236
    ) {
      items = items.map((item) => ({ ...item, kind: item.kind ?? "video" }));
    }
  }

  return items
    .filter((item) => item.kind === "image" || item.kind === "video")
    .map((item) => ({ ...item, event }));
}
