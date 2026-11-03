import { describe, expect, it } from "vitest";
import type { NostrEvent } from "nostr-tools";
import { decodeGeohash, getEventLocation } from "../src/services/Geohash";
import { getThreadInfo } from "../src/services/ThreadService";
import { defaultDisplayMode } from "../src/services/DisplayService";

const PUBKEY =
  "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
const ROOT = "a".repeat(64);
const PARENT = "b".repeat(64);

let counter = 0;
const event = (
  kind: number,
  tags: string[][] = [],
  content = "",
): NostrEvent => ({
  id: (counter++).toString(16).padStart(64, "0"),
  pubkey: PUBKEY,
  created_at: 1_700_000_000,
  kind,
  tags,
  content,
  sig: "",
});

describe("decodeGeohash", () => {
  it("decodes to the centre of the cell", () => {
    // ezs42 is the classic example, near León, Spain
    const point = decodeGeohash("ezs42")!;
    expect(point.lat).toBeCloseTo(42.605, 2);
    expect(point.lon).toBeCloseTo(-5.603, 2);
  });

  it("rejects characters outside the geohash alphabet", () => {
    expect(decodeGeohash("abc")).toBeUndefined(); // "a" isn't valid
    expect(decodeGeohash("")).toBeUndefined();
  });

  it("uses the most precise g tag", () => {
    const point = getEventLocation(
      event(37516, [
        ["g", "u"],
        ["g", "u4pruydqqvj"],
        ["g", "u4p"],
      ]),
    );
    expect(point?.geohash).toBe("u4pruydqqvj");
  });
});

describe("getThreadInfo", () => {
  it("groups a NIP-10 reply under its root", () => {
    const reply = event(1, [
      ["e", ROOT, "", "root"],
      ["e", PARENT, "", "reply"],
    ]);
    expect(getThreadInfo(reply)).toMatchObject({
      key: `e:${ROOT}`,
      parent: PARENT,
      chat: false,
    });
  });

  it("starts a conversation for a note that isn't a reply", () => {
    const note = event(1);
    expect(getThreadInfo(note).key).toBe(`e:${note.id}`);
  });

  it("groups NIP-22 comments under their root, including external roots", () => {
    const comment = event(1111, [
      ["E", ROOT, "", PUBKEY],
      ["K", "1"],
      ["e", PARENT, "", PUBKEY],
      ["k", "1111"],
    ]);
    expect(getThreadInfo(comment)).toMatchObject({
      key: `e:${ROOT}`,
      parent: PARENT,
    });

    const web = event(1111, [
      ["I", "https://example.com/post"],
      ["K", "web"],
      ["i", "https://example.com/post"],
      ["k", "web"],
    ]);
    expect(getThreadInfo(web).key).toBe("i:https://example.com/post");
  });

  it("groups chat by group and live chat by live event", () => {
    expect(getThreadInfo(event(9, [["h", "pizza"]]))).toMatchObject({
      key: "h:pizza",
      chat: true,
    });
    expect(
      getThreadInfo(event(1311, [["a", `30311:${PUBKEY}:stream`]])).key,
    ).toBe(`a:30311:${PUBKEY}:stream`);
  });
});

describe("defaultDisplayMode", () => {
  const mode = (kinds: number[]) =>
    defaultDisplayMode({ kinds, mimeTypes: [] });

  it("picks the new views from their kinds", () => {
    expect(mode([31922, 31923])).toBe("calendar");
    expect(mode([30402])).toBe("market");
    expect(mode([37516])).toBe("map");
    expect(mode([11, 1111])).toBe("threads");
  });

  it("keeps notes on the timeline and never auto-selects stats", () => {
    expect(mode([1])).toBe("timeline");
    expect(mode([])).toBe("timeline");
  });
});
