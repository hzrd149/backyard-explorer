import type { NostrEvent } from "nostr-tools";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export interface GeoPoint {
  lat: number;
  lon: number;
  /** Half the height and width of the geohash cell, in degrees */
  latError: number;
  lonError: number;
  geohash: string;
}

/** Decode a geohash to the centre of its cell, or undefined if it isn't one */
export function decodeGeohash(input: string): GeoPoint | undefined {
  const geohash = input.trim().toLowerCase();
  if (!geohash || geohash.length > 12) return undefined;

  let lat: [number, number] = [-90, 90];
  let lon: [number, number] = [-180, 180];
  let even = true;
  for (const char of geohash) {
    const value = BASE32.indexOf(char);
    if (value === -1) return undefined;
    for (let bit = 4; bit >= 0; bit--) {
      const range = even ? lon : lat;
      const mid = (range[0] + range[1]) / 2;
      if ((value >> bit) & 1) range[0] = mid;
      else range[1] = mid;
      even = !even;
    }
  }
  return {
    lat: (lat[0] + lat[1]) / 2,
    lon: (lon[0] + lon[1]) / 2,
    latError: (lat[1] - lat[0]) / 2,
    lonError: (lon[1] - lon[0]) / 2,
    geohash,
  };
}

const cache = new WeakMap<NostrEvent, GeoPoint | null>();

/**
 * The location of an event from its `g` tags. Events often carry the same
 * place at several precisions, so the most precise one is used.
 */
export function getEventLocation(event: NostrEvent): GeoPoint | undefined {
  let point = cache.get(event);
  if (point === undefined) {
    const geohashes = event.tags
      .filter((t) => t[0] === "g" && t[1])
      .map((t) => t[1])
      .sort((a, b) => b.length - a.length);
    point = null;
    for (const geohash of geohashes) {
      const decoded = decodeGeohash(geohash);
      if (decoded) {
        point = decoded;
        break;
      }
    }
    cache.set(event, point);
  }
  return point ?? undefined;
}
