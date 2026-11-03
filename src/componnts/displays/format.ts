import type { NostrEvent } from "nostr-tools";
import { naddrEncode, neventEncode } from "nostr-tools/nip19";

/** Human readable byte size */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i ? 1 : 0))} ${sizes[i]}`;
}

/** Short locale date for a unix timestamp */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

/** Locale date and time for a unix timestamp */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** First value of a tag, e.g. `tagValue(event, "title")` */
export function tagValue(
  event: { tags: string[][] },
  name: string,
): string | undefined {
  return event.tags.find((t) => t[0] === name && t[1] !== undefined)?.[1];
}

/** A `nostr:` link to an event, as an naddr for addressable kinds */
export function eventLink(event: NostrEvent): string {
  try {
    if (event.kind >= 30000 && event.kind < 40000) {
      const identifier = tagValue(event, "d") ?? "";
      return `nostr:${naddrEncode({ kind: event.kind, pubkey: event.pubkey, identifier })}`;
    }
    return `nostr:${neventEncode({ id: event.id, author: event.pubkey, kind: event.kind })}`;
  } catch {
    return `nostr:${event.id}`;
  }
}
