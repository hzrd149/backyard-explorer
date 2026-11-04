/**
 * Hash deep links, e.g. `#/p/npub1…`, that open as a search. Hash routes work
 * on GitHub Pages and nsite, which can't rewrite paths to index.html.
 *
 *   #/e/<note | nevent | hex id>   the event
 *   #/a/<naddr>                    the addressable event
 *   #/p/<npub | nprofile | hex>    events by the person
 *   #/t/<hashtag>                  events with the hashtag
 *   #/q/<query>                    any query, URL encoded
 */
import { nip19 } from "nostr-tools";
import { decodePubkey, decodeReference } from "./QueryPlanner";

const ROUTE = /^#?\/?([eaptq])\/(.+)$/i;

/** The search a deep link opens, or undefined when the hash isn't one */
export function routeToQuery(hash: string): string | undefined {
  const match = ROUTE.exec(hash.trim());
  if (!match) return undefined;
  const [, route, raw] = match;
  let value: string;
  try {
    value = decodeURIComponent(raw).trim();
  } catch {
    return undefined;
  }
  if (!value) return undefined;

  switch (route.toLowerCase()) {
    case "e": {
      const ref = decodeReference(value);
      return ref?.type === "event" ? value : undefined;
    }
    case "a": {
      const ref = decodeReference(value);
      return ref?.type === "address" ? value : undefined;
    }
    case "p": {
      const pubkey = decodePubkey(value);
      return pubkey ? `by:${nip19.npubEncode(pubkey)}` : undefined;
    }
    case "t": {
      const tag = value.replace(/^#/, "");
      return /^[^\s()"]+$/.test(tag) ? `#${tag}` : undefined;
    }
    case "q":
      return value;
  }
  return undefined;
}

/** A shareable deep link for an event, person or hashtag */
export function deepLink(
  route: "e" | "a" | "p" | "t" | "q",
  value: string,
  base = window.location.href,
): string {
  const url = new URL(base);
  url.search = "";
  url.hash = `/${route}/${encodeURIComponent(value)}`;
  return url.toString();
}
