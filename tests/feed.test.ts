import { describe, expect, it } from "vitest";
import type { NostrEvent } from "nostr-tools";
import type { Filter } from "applesauce-core/helpers";
import { firstValueFrom, filter as where } from "rxjs";
import { createAscendingFeed } from "../src/services/AscendingFeed";
import { planQuery, QueryError } from "../src/services/QueryPlanner";
import { stripViewTokens } from "../src/services/DisplayService";

const NOW = 1_000_000;

function makeEvents(times: number[], kind = 1): NostrEvent[] {
  return times.map((created_at, i) => ({
    id: `${kind}-${i}`.padStart(64, "0"),
    pubkey: "0".repeat(64),
    created_at,
    kind,
    tags: [],
    content: "",
    sig: "",
  }));
}

/** A relay that, like a real one, returns the newest matches up to the limit */
function fakeRelay(events: NostrEvent[]) {
  const requests: Filter[] = [];
  const request = async (filters: Filter[]) => {
    const [f] = filters;
    requests.push(f);
    return events
      .filter(
        (e) =>
          (!f.kinds || f.kinds.includes(e.kind)) &&
          e.created_at >= (f.since ?? 0) &&
          e.created_at <= (f.until ?? Infinity),
      )
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, f.limit ?? Infinity);
  };
  return { request, requests };
}

async function loadAll(filters: Filter[], events: NostrEvent[], cap?: number) {
  const relay = fakeRelay(events);
  const feed = createAscendingFeed(filters, {
    request: relay.request,
    now: () => NOW,
    cap,
  });
  await firstValueFrom(feed.state$.pipe(where((s) => s.complete || !!s.error)));
  const result = await firstValueFrom(feed.events$);
  feed.close();
  return { result, requests: relay.requests };
}

describe("sort:", () => {
  it("is a plan option, not part of the filter", () => {
    const plan = planQuery("kind:1 sort:old", { now: new Date(NOW * 1000) });
    expect(plan.sort).toBe("old");
    expect(plan.branches[0].filter).toEqual({ kinds: [1], limit: 500 });
    expect(planQuery("kind:1 order:newest").sort).toBe("new");
    expect(() => planQuery("kind:1 sort:random")).toThrow(QueryError);
    expect(() => planQuery("by:(a OR sort:old)")).toThrow(QueryError);
  });

  it("is kept when the view changes, since it changes what is fetched", () => {
    expect(stripViewTokens("kind:1 sort:old view:images")).toBe(
      "kind:1 sort:old",
    );
  });
});

describe("createAscendingFeed", () => {
  it("returns every event oldest first", async () => {
    // A dense burst among sparse events, more than one request can return
    const times = [
      10,
      500,
      ...Array.from({ length: 900 }, (_, i) => 600_000 + i),
      999_000,
    ];
    const { result } = await loadAll([{ kinds: [1] }], makeEvents(times));
    expect(result.map((e) => e.created_at)).toEqual(
      [...times].sort((a, b) => a - b),
    );
  });

  it("handles more events in one second than a request returns", async () => {
    const times = Array.from({ length: 400 }, () => 5000);
    const { result } = await loadAll([{ kinds: [1] }], makeEvents(times));
    expect(result).toHaveLength(400);
  });

  it("keeps each branch's own date range", async () => {
    const events = [
      ...makeEvents([100, 200, 900], 1),
      ...makeEvents([100, 800], 20),
    ];
    const { result } = await loadAll(
      [
        { kinds: [1], until: 300 },
        { kinds: [20], since: 500 },
      ],
      events,
    );
    expect(result.map((e) => [e.kind, e.created_at])).toEqual([
      [1, 100],
      [1, 200],
      [20, 800],
    ]);
  });

  it("stops at the cap", async () => {
    const times = Array.from({ length: 300 }, (_, i) => i * 1000);
    const { result } = await loadAll([{ kinds: [1] }], makeEvents(times), 25);
    expect(result.map((e) => e.created_at)).toEqual(times.slice(0, 25));
  });

  it("finishes straight away when nothing matches", async () => {
    const { result, requests } = await loadAll([{ kinds: [1] }], []);
    expect(result).toEqual([]);
    expect(requests).toHaveLength(1);
  });
});
