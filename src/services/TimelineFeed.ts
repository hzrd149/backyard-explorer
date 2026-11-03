import type { NostrEvent } from "nostr-tools";
import { EventStore } from "applesauce-core";
import type { Filter } from "applesauce-core/helpers";
import {
  createTimelineLoader,
  type TimelineStatus,
  type TimelineWindow,
} from "applesauce-loaders/loaders";
import {
  animationFrameScheduler,
  asapScheduler,
  auditTime,
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  merge,
  observeOn,
  shareReplay,
  switchMap,
  take,
  tap,
  throttleTime,
  type Observable,
  type Subscription,
} from "rxjs";

/** Events added to the rendered range each time the bottom of the list comes into view */
const PAGE = 24;
/** How far back to reach when nothing is buffered below the range, doubled while it finds few events */
const STEP = 6 * 60 * 60;
const MAX_STEP = 2 * 365 * 24 * 60 * 60;
/** Events requested from window.nostrdb per batch, and buffered below the rendered range */
const BATCH = 60;

export interface FeedState {
  /** A visible range is still loading */
  loading: boolean;
  /** Every matching event down to the oldest allowed time has been rendered */
  complete: boolean;
  /** Why loading failed, if it did */
  error?: string;
  /** The rendered time range */
  range: TimelineWindow;
}

export interface TimelineFeed {
  /** The rendered events, newest first. The array changes, the event objects stay the same */
  events$: Observable<NostrEvent[]>;
  state$: Observable<FeedState>;
  /** Tell the feed whether the bottom of the list is near the viewport */
  setNearEnd(near: boolean): void;
  /** Stop all loading */
  close(): void;
}

const now = () => Math.floor(Date.now() / 1000);

/** Every source finished loading the window (not exported by applesauce-loaders 7.0.2) */
function isCovered(window: TimelineWindow, statuses: TimelineStatus[]) {
  const active = statuses.filter((s) => s.state !== "removed");
  return (
    active.length > 0 &&
    active.every(
      (s) =>
        s.window.since <= window.since &&
        s.window.until >= Math.min(window.until, now()) &&
        (s.state === "covered" || s.state === "prefetching"),
    )
  );
}

/** The cache-only loader reads from window.nostrdb, there are no relays */
const noRelays = () => EMPTY;
const cacheRequest = (filters: Filter[]) => window.nostrdb.query(filters);

/**
 * Creates an infinitely scrolling feed over window.nostrdb for a set of filters.
 *
 * Based on the applesauce infinite-scroll example: an applesauce timeline
 * loader follows a growing time window and keeps a page of older events
 * buffered below it, so the rendered range can usually grow instantly from
 * the buffer. The `since` / `until` of the filters bound the feed.
 */
export function createTimelineFeed(
  filters: Filter[],
  opts?: { cap?: number },
): TimelineFeed {
  const base = filters[0] ?? {};
  // The user's `since:` and `until:` bound the feed
  const floor = Math.max(0, base.since ?? 0);
  const head = Math.max(floor, Math.min(now(), base.until ?? now()));
  // A `limit:` the user typed caps the total number of rendered events
  const cap = opts?.cap && opts.cap > 0 ? opts.cap : Infinity;

  // The loader takes filters without time bounds, they come from the window
  const timeless = filters.map(
    ({ since: _s, until: _u, limit: _l, ...rest }) => rest,
  );
  // The store only holds events the loader returned for this feed, so it doesn't need
  // to (and can't) match full text search itself
  const local = timeless.map(({ search: _q, ...rest }) => rest as Filter);

  // A store per feed, so events from earlier searches never show up here
  const store = new EventStore();
  const loader = createTimelineLoader(noRelays, [], timeless, {
    cache: cacheRequest,
    eventStore: store,
    limit: BATCH,
  });

  const range$ = new BehaviorSubject<TimelineWindow>({
    since: head,
    until: head,
  });
  const near$ = new BehaviorSubject(true);
  const step$ = new BehaviorSubject(STEP);
  // Read statuses outside the loader's own emission, the windows they produce feed back into it
  const statuses$ = loader.status$.pipe(
    observeOn(asapScheduler),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const count = (range: TimelineWindow) =>
    store.getByFilters(local.map((f) => ({ ...f, ...range }))).length;

  /** The oldest time to extend the range to, taken from the buffer when it holds a page */
  const older = (
    range: TimelineWindow,
    step: number,
    statuses: TimelineStatus[],
  ) => {
    const below = store.getByFilters(
      local.map((f) => ({ ...f, until: range.since - 1, limit: PAGE })),
    );
    if (below.length >= PAGE)
      return Math.max(floor, Math.min(...below.map((e) => e.created_at)));

    // Fewer than a page is buffered: if the buffer below the range is fully loaded, it
    // holds everything down to its edge and the range can jump straight there
    const loaded = statuses.find(
      (s) => s.state === "covered" && s.buffer.since < range.since,
    );
    if (loaded) return Math.max(floor, loaded.buffer.since);

    // The buffer is still loading: wait for it rather than guessing a time span, which
    // could pull thousands of events into one render on a busy database
    if (statuses.length === 0 || statuses.some((s) => s.state !== "covered"))
      return range.since;

    // Last resort when the buffer didn't reach below the range
    return Math.max(floor, range.since - step);
  };

  const done = (range: TimelineWindow) =>
    range.since <= floor || count(range) >= cap;

  // The window the loader should cover: the rendered range, reaching further back when
  // the end of the list is near the viewport
  const windows$ = combineLatest([range$, near$, step$, statuses$]).pipe(
    map(([range, near, step, statuses]) =>
      near && !done(range)
        ? { since: older(range, step, statuses), until: head }
        : range,
    ),
    distinctUntilChanged((a, b) => a.since === b.since && a.until === b.until),
    throttleTime(50, undefined, { leading: true, trailing: true }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Grow the rendered range once the cache has answered for a window
  const commits$ = windows$.pipe(
    switchMap((window) =>
      statuses$.pipe(
        filter((statuses) =>
          statuses.some(
            (s) =>
              s.window.since === window.since &&
              s.window.until === Math.min(window.until, now()) &&
              s.state !== "loading",
          ),
        ),
        take(1),
        map(() => window),
      ),
    ),
    // Let the DOM render the last page, so the sentinel observer reports where it is now
    observeOn(animationFrameScheduler),
    tap((window) => {
      const range = range$.value;
      const next = {
        since: Math.min(range.since, window.since),
        until: Math.max(range.until, window.until),
      };
      if (next.since === range.since && next.until === range.until) return;

      // Quiet stretches add few events, so reach further next time
      step$.next(
        count(next) - count(range) < PAGE
          ? Math.min(step$.value * 2, MAX_STEP)
          : STEP,
      );
      range$.next(next);
    }),
  );

  // Render the range, batching streamed events into one update per frame
  const events$ = range$.pipe(
    switchMap((range) =>
      store.timeline(local.map((f) => ({ ...f, ...range }))),
    ),
    map((events) => (cap < Infinity ? events.slice(0, cap) : events)),
    auditTime(0, animationFrameScheduler),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const state$ = combineLatest([range$, statuses$, near$]).pipe(
    map(([range, statuses, near]): FeedState => {
      const covered = isCovered(range, statuses);
      const complete = done(range) && covered;
      const failed = statuses.find(
        (s) => s.state === "incomplete" && s.reason === "request",
      );
      return {
        range,
        complete,
        loading:
          !failed &&
          (statuses.length === 0 ||
            statuses.some((s) => s.state === "loading") ||
            (near && !complete)),
        error: failed ? String(failed.error ?? "Failed to load") : undefined,
      };
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Keep loading while the feed is open, whether or not anything is rendering it
  const session: Subscription = merge(loader(windows$), commits$).subscribe({
    error: (error) => console.error("Feed failed:", error),
  });

  return {
    events$,
    state$,
    setNearEnd: (near) => {
      if (near$.value !== near) near$.next(near);
    },
    close: () => {
      session.unsubscribe();
      range$.complete();
      near$.complete();
      step$.complete();
    },
  };
}
