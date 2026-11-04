import { describe, expect, it } from "vitest";
import type { NostrEvent } from "nostr-tools";
import { nip19 } from "nostr-tools";
import { deepLink, routeToQuery } from "../src/services/DeepLinks";
import { getEventBlobHashes } from "../src/services/BlobHashes";
import { planQuery } from "../src/services/QueryPlanner";

const PUBKEY =
  "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
const EVENT =
  "d3d74124ddfb5bdc61b8f18d17c3335bbb4f8c71182a35ee27314a49a4eb7b1d";
const HASH = "f4153a3d388eda4688c9b05cf2e5d11ecbd8d0909ddc706470c62741764aabcd";
const OTHER =
  "273b4069e7a36d13b80ca1e8a98276b24d91232958ce037acb4a5ed749433e85";

describe("routeToQuery", () => {
  const npub = nip19.npubEncode(PUBKEY);

  it("opens people as their events", () => {
    expect(routeToQuery(`#/p/${npub}`)).toBe(`by:${npub}`);
    expect(routeToQuery(`#/p/${PUBKEY}`)).toBe(`by:${npub}`);
    expect(
      routeToQuery(`#/p/${nip19.nprofileEncode({ pubkey: PUBKEY })}`),
    ).toBe(`by:${npub}`);
  });

  it("opens events, addresses, hashtags and queries", () => {
    const nevent = nip19.neventEncode({ id: EVENT });
    expect(routeToQuery(`#/e/${nevent}`)).toBe(nevent);
    expect(routeToQuery(`#/e/${EVENT}`)).toBe(EVENT);
    const naddr = nip19.naddrEncode({
      kind: 30023,
      pubkey: PUBKEY,
      identifier: "x",
    });
    expect(routeToQuery(`#/a/${naddr}`)).toBe(naddr);
    expect(routeToQuery("#/t/nostr")).toBe("#nostr");
    expect(routeToQuery("#/q/kind%3A1%20%23nostr")).toBe("kind:1 #nostr");
  });

  it("ignores anything else", () => {
    expect(routeToQuery("")).toBeUndefined();
    expect(routeToQuery("#section")).toBeUndefined();
    expect(routeToQuery("#/e/nonsense")).toBeUndefined();
    expect(routeToQuery(`#/e/${npub}`)).toBeUndefined();
    expect(routeToQuery("#/t/two words")).toBeUndefined();
  });

  it("produces queries that plan", () => {
    for (const hash of [`#/p/${npub}`, "#/t/nostr", `#/e/${EVENT}`]) {
      expect(() => planQuery(routeToQuery(hash)!)).not.toThrow();
    }
  });

  it("round-trips through deepLink", () => {
    const link = deepLink("q", "kind:1 #nostr", "https://example.com/app/?q=x");
    expect(link).toBe("https://example.com/app/#/q/kind%3A1%20%23nostr");
    expect(routeToQuery(new URL(link).hash)).toBe("kind:1 #nostr");
  });
});

describe("getEventBlobHashes", () => {
  const event = (tags: string[][], content = ""): NostrEvent => ({
    id: EVENT,
    pubkey: PUBKEY,
    created_at: 0,
    kind: 1,
    tags,
    content,
    sig: "",
  });

  it("reads imeta x fields and URLs", () => {
    const blobs = getEventBlobHashes(
      event(
        [
          [
            "imeta",
            `url https://cdn.example/${HASH}.jpg`,
            "m image/jpeg",
            `x ${HASH}`,
          ],
        ],
        `look https://cdn.example/${HASH}.jpg and https://other.example/${OTHER}`,
      ),
    );
    expect(blobs).toEqual([
      {
        sha256: HASH,
        url: `https://cdn.example/${HASH}.jpg`,
        mime: "image/jpeg",
      },
      { sha256: OTHER, url: `https://other.example/${OTHER}`, mime: undefined },
    ]);
  });

  it("reads NIP-94 x tags", () => {
    expect(
      getEventBlobHashes(
        event([
          ["x", HASH],
          ["m", "video/mp4"],
        ]),
      ),
    ).toEqual([{ sha256: HASH, url: undefined, mime: "video/mp4" }]);
  });

  it("ignores links without a hash", () => {
    expect(getEventBlobHashes(event([], "https://example.com/a.jpg"))).toEqual(
      [],
    );
  });
});

describe("andIntoQuery", () => {
  it("groups OR queries and keeps view/sort tokens outside", async () => {
    const { andIntoQuery } = await import("../src/context/SearchContext");
    expect(andIntoQuery("kind:1 OR kind:6 view:images", "kind:6")).toBe(
      "(kind:1 OR kind:6) kind:6 view:images",
    );
    expect(andIntoQuery("kind:1 #nostr", "by:alice")).toBeUndefined();
    expect(andIntoQuery("(a OR", "x")).toBeUndefined();
  });
});
