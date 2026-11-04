import type { NostrEvent } from "nostr-tools";
import type { Filter } from "applesauce-core/helpers";
import { BehaviorSubject } from "rxjs";
import type { FeedState, TimelineFeed } from "./TimelineFeed";

/** Events added per step before the list is rendered again */
const PAGE = 60;
/** Events asked for per filter and window; getting this many means the window was cut short */
const LIMIT = 250;
/** A one-second window can't be split further, so take more of it */
const SECOND_LIMIT = 5000;

export type FeedRequest = (filters: Filter[]) => Promise<NostrEvent[]>;

export interface AscendingFeedOptions {
  /** Most events to render, from `limit:` */
  cap?: number;
  /** Where events come from, `window.nostrdb.query` by default */
  request?: FeedRequest;
  now?: () => number;
}

const byTimeThenId = (a: NostrEvent, b: NostrEvent) =>
  a.created_at - b.created_at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * An oldest-first feed that works on relays without NIP-45 COUNT.
 *
 * Relays return the newest events of a filter, so a page of the oldest ones
 * can't be asked for directly. Instead the feed walks a time window forward
 * from the start: a window that comes back full is halved and asked again,
 * one that comes back sparse is widened for the next step. Every window that
 * is kept was returned in full, so no event is skipped.
 *
 * Each filter keeps its own `since` / `until`, so OR branches with different
 * dates are each bounded correctly.
 */
export function createAscendingFeed(
  filters: Filter[],
  opts: AscendingFeedOptions = {},
): TimelineFeed {
  const request: FeedRequest = opts.request ?? ((f) => window.nostrdb.query(f));
  const nowSeconds = opts.now ?? (() => Math.floor(Date.now() / 1000));
  const cap = opts.cap && opts.cap > 0 ? opts.cap : Infinity;

  const now = nowSeconds();
  const floor = filters.some((f) => f.since === undefined)
    ? 0
    : Math.min(...filters.map((f) => f.since!));
  const head = Math.min(
    now,
    filters.some((f) => f.until === undefined)
      ? now
      : Math.max(...filters.map((f) => f.until!)),
  );
  const bare = filters.map(({ limit: _l, ...rest }) => rest);

  let cursor = floor;
  let span = Math.max(1, head - floor + 1);
  let events: NostrEvent[] = [];
  const seen = new Set<string>();
  let near = true;
  let running = false;
  let closed = false;
  let complete = head < floor;
  let error: string | undefined;

  const events$ = new BehaviorSubject<NostrEvent[]>([]);
  const state$ = new BehaviorSubject<FeedState>(snapshot());

  function snapshot(): FeedState {
    return {
      loading: running || (near && !complete && !error),
      complete,
      error,
      // The rendered range runs from the floor up to the window loaded last
      range: {
        since: floor,
        until: Math.min(head, Math.max(floor, cursor - 1)),
      },
    };
  }

  const emitState = () => {
    if (!closed) state$.next(snapshot());
  };

  /** Load the next window; returns how many new events were added */
  async function step(): Promise<number> {
    const since = cursor;
    const until = Math.min(head, cursor + span - 1);
    const limit = span === 1 ? SECOND_LIMIT : LIMIT;

    // Ask each branch separately so a full one can be told apart from the rest
    const results = await Promise.all(
      bare.map((filter) => {
        const from = Math.max(since, filter.since ?? since);
        const to = Math.min(until, filter.until ?? until);
        if (from > to) return Promise.resolve([] as NostrEvent[]);
        return request([{ ...filter, since: from, until: to, limit }]);
      }),
    );
    if (closed) return 0;

    if (span > 1 && results.some((r) => r.length >= limit)) {
      span = Math.max(1, Math.floor(span / 2));
      return 0;
    }

    const fresh = results.flat().filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    fresh.sort(byTimeThenId);
    events = events.concat(fresh);
    if (events.length >= cap) {
      events = events.slice(0, cap);
      complete = true;
    }

    cursor = until + 1;
    if (cursor > head) complete = true;
    // Quiet stretches take few events, so look further ahead next time
    if (fresh.length < PAGE / 2) span = Math.min(span * 2, head - floor + 1);
    return fresh.length;
  }

  async function pump() {
    if (running || closed) return;
    running = true;
    emitState();
    try {
      while (near && !complete && !closed) {
        let added = 0;
        while (added < PAGE && !complete && !closed) added += await step();
        if (closed) return;
        events$.next(events);
        emitState();
        // Let the list render so the sentinel can say whether more is needed
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      running = false;
      emitState();
    }
  }

  // Start right away, like the newest-first feed does
  queueMicrotask(pump);

  return {
    events$: events$.asObservable(),
    state$: state$.asObservable(),
    setNearEnd(next) {
      if (near === next) return;
      near = next;
      if (near) pump();
      else emitState();
    },
    close() {
      closed = true;
      events$.complete();
      state$.complete();
    },
  };
}
