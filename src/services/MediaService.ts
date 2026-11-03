import {
  getSha256FromURL,
  type FileMetadataFields,
} from "applesauce-common/helpers";
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
  };
}
