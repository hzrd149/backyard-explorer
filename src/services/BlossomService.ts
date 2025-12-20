import mime from "mime";
import { getBlossomProxyUrl } from "./ConfigService";

/**
 * Check if a URL matches the BUD-01 pattern: https://server.com/{sha256}.{ext}
 */
export function isBud01Url(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) return false;

    const filename = pathParts[pathParts.length - 1];
    const parts = filename.split(".");

    // Check if we have at least a hash (64 hex chars) and optionally an extension
    if (parts.length < 1) return false;

    const hashPart = parts[0];
    // SHA-256 is 64 hex characters
    if (!/^[0-9a-f]{64}$/i.test(hashPart)) return false;

    // Must be http or https
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Check if a string is a BUD-10 URI: blossom:{sha256}.{ext}?xs={server}&as={pubkey}
 */
export function isBud10Uri(uri: string): boolean {
  return uri.startsWith("blossom:");
}

/**
 * Extract SHA-256 hash from a BUD-01 URL
 */
export function extractHashFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) return null;

    const filename = pathParts[pathParts.length - 1];
    const parts = filename.split(".");
    const hashPart = parts[0];

    if (/^[0-9a-f]{64}$/i.test(hashPart)) {
      return hashPart.toLowerCase();
    }
  } catch {
    // Invalid URL
  }
  return null;
}

/**
 * Get file extension from URL or MIME type
 */
export function getFileExtension(
  url: string | null,
  mimeType?: string,
): string | null {
  // Try to get extension from URL first
  if (url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        const filename = pathParts[pathParts.length - 1];
        const parts = filename.split(".");
        if (parts.length > 1) {
          const ext = parts[parts.length - 1].toLowerCase();
          // Only return if it's a reasonable extension (1-5 chars, alphanumeric)
          if (/^[a-z0-9]{1,5}$/i.test(ext)) {
            return ext;
          }
        }
      }
    } catch {
      // Invalid URL, fall back to MIME type
    }
  }

  // Use mime package to get extension from MIME type
  if (mimeType) {
    const ext = mime.getExtension(mimeType);
    if (ext) {
      return ext;
    }
  }

  return null;
}

/**
 * Construct a Blossom proxy URL from just the SHA-256 hash
 * Format: {proxyBase}/{sha256}.{ext}?as={pubkey}
 */
export function constructBlossomProxyUrl(
  sha256: string,
  ext?: string | null,
  pubkey?: string,
): string | null {
  const proxyBase = getBlossomProxyUrl();
  if (!proxyBase) return null;

  // Validate SHA-256 hash
  if (!/^[0-9a-f]{64}$/i.test(sha256)) return null;

  const hash = sha256.toLowerCase();
  const extension = ext ? `.${ext}` : "";
  const proxyUrl = new URL(`/${hash}${extension}`, proxyBase);

  // Add author pubkey as `as` parameter if provided
  if (pubkey) {
    proxyUrl.searchParams.append("as", pubkey);
  }

  return proxyUrl.toString();
}

/**
 * Transform a BUD-01 URL to Blossom proxy format
 */
function transformBud01Url(url: string, pubkey?: string): string | null {
  const proxyBase = getBlossomProxyUrl();
  if (!proxyBase) return null;

  try {
    const urlObj = new URL(url);
    // Replace the origin with the proxy base, keep path and query
    const proxyUrl = new URL(urlObj.pathname + urlObj.search, proxyBase);

    // Add server hint (sx parameter) - original hostname
    proxyUrl.searchParams.append("sx", urlObj.hostname);

    // Add author pubkey as `as` parameter if provided
    if (pubkey) {
      proxyUrl.searchParams.append("as", pubkey);
    }

    return proxyUrl.toString();
  } catch {
    return null;
  }
}

/**
 * Transform a BUD-10 URI to Blossom proxy format
 */
function transformBud10Uri(uri: string, pubkey?: string): string | null {
  const proxyBase = getBlossomProxyUrl();
  if (!proxyBase) return null;

  try {
    // Remove "blossom:" prefix and build proxy URL
    const uriWithoutScheme = uri.replace(/^blossom:/, "");
    const proxyUrl = new URL(uriWithoutScheme, proxyBase);

    // Map xs (server hints) to sx parameter
    const xsValues = proxyUrl.searchParams.getAll("xs");
    proxyUrl.searchParams.delete("xs");
    xsValues.forEach((server) => {
      // Remove protocol if present
      const cleanServer = server.replace(/^https?:\/\//, "");
      proxyUrl.searchParams.append("sx", cleanServer);
    });

    // Add author pubkey as `as` parameter if provided (and not already present)
    if (pubkey && !proxyUrl.searchParams.has("as")) {
      proxyUrl.searchParams.append("as", pubkey);
    }

    return proxyUrl.toString();
  } catch {
    return null;
  }
}

/**
 * Transform a Blossom URL (BUD-01 or BUD-10) to use the proxy server
 *
 * @param url - The URL to transform (can be null for hash-only construction)
 * @param metadata - Optional metadata with sha256, type, and pubkey
 * @returns Transformed URL or null if transformation is not possible/needed
 */
export function transformBlossomUrl(
  url: string | null,
  metadata?: {
    sha256?: string;
    type?: string;
    pubkey?: string;
  },
): string | null {
  const proxyBase = getBlossomProxyUrl();
  if (!proxyBase) {
    // If proxy not configured, return original URL or null
    return url;
  }

  // If URL is null but we have SHA-256 hash, construct from hash
  if (!url && metadata?.sha256) {
    const ext = getFileExtension(null, metadata.type);
    return constructBlossomProxyUrl(metadata.sha256, ext, metadata.pubkey);
  }

  if (!url) return null;

  // Check if it's a BUD-10 URI
  if (isBud10Uri(url)) {
    return transformBud10Uri(url, metadata?.pubkey);
  }

  // Check if it's a BUD-01 URL
  if (isBud01Url(url)) {
    return transformBud01Url(url, metadata?.pubkey);
  }

  // Not a Blossom URL, return original
  return url;
}
