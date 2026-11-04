import { describe, expect, it } from "vitest";
import { nip19 } from "nostr-tools";
import fixtures from "./fixtures/ants-queries.json";
import { searchExamples } from "../src/examples";
import {
  QueryError,
  planQuery,
  resolvePlan,
  type PlanOptions,
} from "../src/services/QueryPlanner";

const NOW = new Date(fixtures.now);
const ANTS: PlanOptions = { now: NOW, defaultKinds: fixtures.defaultKinds };
const OPTIONS: PlanOptions = { now: NOW };

const PUBKEY =
  "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
const OTHER =
  "82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2";
const EVENT =
  "d3d74124ddfb5bdc61b8f18d17c3335bbb4f8c71182a35ee27314a49a4eb7b1d";

const filtersOf = (query: string, options = OPTIONS) =>
  planQuery(query, options).branches.map((b) => b.filter);

/** Expect a QueryError, optionally starting at `position` */
function expectError(query: string, position?: number) {
  let error: unknown;
  try {
    planQuery(query, OPTIONS);
  } catch (e) {
    error = e;
  }
  expect(error, query).toBeInstanceOf(QueryError);
  if (position !== undefined) {
    expect((error as QueryError).position, query).toBe(position);
  }
}

describe("Ants shared fixtures", () => {
  for (const fixture of fixtures.valid) {
    it(`plans ${fixture.query}`, () => {
      const plan = planQuery(fixture.query, ANTS);

      if ("searches" in fixture) {
        expect(plan.branches.map((b) => b.filter.search)).toEqual(
          fixture.searches,
        );
      }
      if ("filters" in fixture) {
        const filters = plan.branches.map(({ filter }) => {
          const { limit: _limit, authors: _authors, ...rest } = filter;
          return rest;
        });
        expect(filters).toEqual(fixture.filters);
      }
      if ("authors" in fixture) {
        expect(
          plan.branches.map((b) =>
            b.pending
              .filter((c) => c.target === "authors")
              .map((c) => c.values),
          ),
        ).toEqual(fixture.authors);
      }
      if ("profiles" in fixture) {
        expect(plan.profileLookup).toEqual(fixture.profiles);
      }
    });
  }

  for (const query of fixtures.invalid) {
    it(`rejects ${JSON.stringify(query)}`, () => expectError(query));
  }
});

describe("search examples", () => {
  it.each(searchExamples)("plans %s", (example) => {
    expect(() => planQuery(example, OPTIONS)).not.toThrow();
  });
});

describe("fields", () => {
  it("defaults the limit and adds no kinds", () => {
    expect(filtersOf("bitcoin")).toEqual([{ search: "bitcoin", limit: 500 }]);
  });

  it("keeps the user's limit", () => {
    const plan = planQuery("is:note limit:50", OPTIONS);
    expect(plan.branches[0].filter.limit).toBe(50);
    expect(plan.limit).toBe(50);
  });

  it("merges OR'd kinds into one filter", () => {
    expect(filtersOf("kind:1 OR kind:20 OR is:video")).toEqual([
      { kinds: [1, 20, 21, 22, 34235, 34236], limit: 500 },
    ]);
  });

  it("intersects repeated kind fields", () => {
    expect(filtersOf("is:media is:image")[0].kinds).toEqual([20]);
  });

  it("merges OR'd hashtags", () => {
    expect(filtersOf("#Nostr OR #bitcoin")[0]["#t"]).toEqual([
      "nostr",
      "bitcoin",
    ]);
  });

  it("expands has: and m: into #m", () => {
    expect(filtersOf("has:gif")[0]["#m"]).toEqual(["image/gif"]);
    expect(filtersOf("m:jpg OR m:png")[0]["#m"]).toEqual([
      "image/jpeg",
      "image/png",
    ]);
    expect(filtersOf("m:image/ m:png")[0]["#m"]).toEqual(["image/png"]);
  });

  it("maps generic tags, mentions and event references", () => {
    const [filter] = filtersOf(
      `tag:d=my-article mentions:${nip19.npubEncode(PUBKEY)} e:${nip19.noteEncode(EVENT)}`,
    );
    expect(filter["#d"]).toEqual(["my-article"]);
    expect(filter["#p"]).toEqual([PUBKEY]);
    expect(filter["#e"]).toEqual([EVENT]);
  });

  it("decodes npub authors and intersects by: clauses", () => {
    const npub = nip19.npubEncode(PUBKEY);
    expect(filtersOf(`by:${npub}`)[0].authors).toEqual([PUBKEY]);
    expect(filtersOf(`by:${PUBKEY},${OTHER} by:${npub}`)[0].authors).toEqual([
      PUBKEY,
    ]);
    expectError(`by:${PUBKEY} by:${OTHER}`);
  });

  it("keeps the raw author: hex alias", () => {
    expect(filtersOf(`author:${PUBKEY}`)[0].authors).toEqual([PUBKEY]);
    expect(filtersOf(`a:${PUBKEY}`)[0].authors).toEqual([PUBKEY]);
  });

  it("collects view: without changing the filter", () => {
    const plan = planQuery("#photography view:Images", OPTIONS);
    expect(plan.view).toBe("images");
    expect(plan.branches[0].filter).toEqual({
      "#t": ["photography"],
      limit: 500,
    });
    expect(planQuery("view:raw", OPTIONS).branches).toEqual([]);
  });

  it("reports shared kinds and MIME types for display modes", () => {
    expect(planQuery("kind:20 OR kind:21", OPTIONS).kinds).toEqual([20, 21]);
    expect(planQuery("kind:20 OR bitcoin", OPTIONS).kinds).toEqual([]);
    expect(planQuery("m:image/ is:file", OPTIONS).mimeTypes).toContain(
      "image/png",
    );
  });

  it("only flags full text queries as needing search", () => {
    expect(planQuery("is:note #nostr", OPTIONS).needsSearch).toBe(false);
    expect(planQuery("is:note OR hello", OPTIONS).needsSearch).toBe(true);
  });
});

describe("dates", () => {
  it("treats YYYY-MM-DD as whole UTC days", () => {
    const [filter] = filtersOf("since:2024-01-01 until:2024-01-01");
    expect(filter.since).toBe(1704067200);
    expect(filter.until).toBe(1704067200 + 86399);
  });

  it("supports relative dates", () => {
    const now = NOW.getTime() / 1000;
    expect(filtersOf("since:12h")[0].since).toBe(now - 12 * 3600);
    // 2026-10-04T12:00Z: 3 days back is the start of 2026-10-01
    expect(filtersOf("since:3d")[0].since).toBe(Date.UTC(2026, 9, 1) / 1000);
    expect(filtersOf("since:1m")[0].since).toBe(Date.UTC(2026, 8, 4) / 1000);
  });

  it("keeps unix timestamps, ISO times and natural language", () => {
    expect(filtersOf("since:1700000000")[0].since).toBe(1700000000);
    expect(filtersOf("since:2024-01-01T12:00:00Z")[0].since).toBe(1704110400);
    expect(filtersOf('until:"last week"')[0].until).toBeLessThan(
      NOW.getTime() / 1000,
    );
  });

  it("narrows repeated dates", () => {
    const [filter] = filtersOf("since:2024-01-01 since:2024-06-01");
    expect(filter.since).toBe(Date.UTC(2024, 5, 1) / 1000);
  });
});

describe("identifiers", () => {
  it("looks up events by note, nevent and hex id", () => {
    expect(filtersOf(nip19.noteEncode(EVENT))[0].ids).toEqual([EVENT]);
    expect(filtersOf(nip19.neventEncode({ id: EVENT }))[0].ids).toEqual([
      EVENT,
    ]);
    expect(filtersOf(EVENT)[0].ids).toEqual([EVENT]);
  });

  it("looks up addresses by naddr", () => {
    const naddr = nip19.naddrEncode({
      kind: 30023,
      pubkey: PUBKEY,
      identifier: "hello",
    });
    expect(filtersOf(`nostr:${naddr}`)[0]).toEqual({
      kinds: [30023],
      "#d": ["hello"],
      authors: [PUBKEY],
      limit: 500,
    });
  });

  it("pulls identifiers out of links", () => {
    const npub = nip19.npubEncode(PUBKEY);
    expect(filtersOf(`https://njump.me/${npub}`)[0].authors).toEqual([PUBKEY]);
    expect(filtersOf("https://example.com/page")[0].search).toBe(
      "https://example.com/page",
    );
  });
});

describe("syntax", () => {
  it("keeps colons inside values and non-field words", () => {
    expect(filtersOf("meet at 12:30")[0].search).toBe("meet at 12:30");
    expect(filtersOf("t:r=wss://relay.example")[0]["#r"]).toEqual([
      "wss://relay.example",
    ]);
  });

  it("quotes phrases for NIP-50 search", () => {
    expect(filtersOf('"car crash" by:npub1x OR x')[1].search).toBe("x");
    expect(filtersOf('"car crash"')[0].search).toBe('"car crash"');
  });

  it("reports error positions", () => {
    expectError("hello unknown:x", 6);
    expectError("kind:1 (a OR b", 7);
    expectError("a OR", 2);
  });

  it("rejects p: mixed with other terms", () => {
    expectError("p:alice kind:1");
    expect(planQuery("p:alice OR p:bob", OPTIONS).profileLookup).toEqual([
      "alice",
      "bob",
    ]);
  });

  it("limits branch expansion", () => {
    const many = Array.from({ length: 6 }, (_, i) => `(a${i} OR b${i})`).join(
      " ",
    );
    expectError(many);
  });
});

describe("resolvePlan", () => {
  it("resolves names once and intersects clauses", async () => {
    const plan = planQuery("by:alice,bob by:bob kind:1 OR by:bob #x", OPTIONS);
    const lookups: string[] = [];
    const filters = await resolvePlan(plan, async (name) => {
      lookups.push(name);
      return name === "alice" ? PUBKEY : OTHER;
    });
    expect(lookups.sort()).toEqual(["alice", "bob"]);
    expect(filters.map((f) => f.authors)).toEqual([[OTHER], [OTHER]]);
  });

  it("fails when a name can't be found", async () => {
    const plan = planQuery("by:nobody", OPTIONS);
    await expect(resolvePlan(plan, async () => undefined)).rejects.toThrow(
      QueryError,
    );
  });
});
