import type { NostrEvent } from "nostr-tools";

export interface BlobRef {
  sha256: string;
  /** Where the hash was found: an imeta / x tag, or a URL */
  url?: string;
  mime?: string;
}

const HEX64 = /^[0-9a-f]{64}$/i;
/** A BUD-01 style URL whose last path segment is a sha256, with an optional extension */
const HASH_IN_URL =
  /https?:\/\/[^\s"'<>]*?\/([0-9a-f]{64})(?:\.[a-z0-9]{1,5})?(?=[?#\s"'<>]|$)/gi;

/** Every Blossom blob an event refers to, by sha256, in order of appearance */
export function getEventBlobHashes(event: NostrEvent): BlobRef[] {
  const found = new Map<string, BlobRef>();
  const add = (sha256: string, url?: string, mime?: string) => {
    const key = sha256.toLowerCase();
    const existing = found.get(key);
    if (existing) {
      existing.url ??= url;
      existing.mime ??= mime;
    } else found.set(key, { sha256: key, url, mime });
  };

  for (const tag of event.tags) {
    if (tag[0] === "imeta") {
      const fields = new Map<string, string>();
      for (const entry of tag.slice(1)) {
        const space = entry.indexOf(" ");
        if (space > 0)
          fields.set(entry.slice(0, space), entry.slice(space + 1));
      }
      const x = fields.get("x");
      const url = fields.get("url");
      const fromUrl = url && [...url.matchAll(HASH_IN_URL)][0]?.[1];
      const hash = x && HEX64.test(x) ? x : fromUrl;
      if (hash) add(hash, url, fields.get("m"));
    } else if (tag[0] === "x" && tag[1] && HEX64.test(tag[1])) {
      // NIP-94 file metadata
      const url = event.tags.find((t) => t[0] === "url")?.[1];
      const mime = event.tags.find((t) => t[0] === "m")?.[1];
      add(tag[1], url, mime);
    }
  }

  for (const match of event.content.matchAll(HASH_IN_URL)) {
    add(match[1], match[0]);
  }

  return [...found.values()];
}
