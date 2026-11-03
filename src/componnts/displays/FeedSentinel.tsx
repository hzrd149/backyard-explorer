import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { FeedState, TimelineFeed } from "../../services/TimelineFeed";

interface FeedSentinelProps {
  feed: TimelineFeed;
  state: FeedState;
  /** Number of rendered events, used for the end-of-results message */
  count: number;
  /**
   * Load this many events at a time on request instead of when scrolled near. For
   * views whose page doesn't grow with their results, so the sentinel never leaves
   * the viewport and would otherwise load the whole database.
   */
  batch?: number;
}

/** Start loading this far before the end of the list scrolls into view */
const MARGIN = "1500px";

/**
 * Sits below the last result and tells the feed to load more while it is
 * near the viewport. Every display mode grows downward, so one sentinel
 * after the display works for all of them.
 */
export default function FeedSentinel(props: FeedSentinelProps) {
  let el: HTMLDivElement | undefined;
  const [visible, setVisible] = createSignal(false);
  // Bounded views load until the count reaches this, starting with one batch
  const [target, setTarget] = createSignal(0);

  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: `${MARGIN} 0px` },
    );
    observer.observe(el!);
    onCleanup(() => {
      observer.disconnect();
      props.feed.setNearEnd(false);
    });
  });

  // Switching into a bounded view loads one batch beyond what is already loaded
  createEffect((wasBounded: boolean) => {
    const bounded = props.batch !== undefined;
    if (bounded && !wasBounded) setTarget(props.count + props.batch!);
    return bounded;
  }, false);

  createEffect(() => {
    const near = props.batch !== undefined ? props.count < target() : visible();
    props.feed.setNearEnd(near && !props.state.complete);
  });

  const waiting = () =>
    props.batch !== undefined ? props.count < target() : true;

  return (
    <div ref={el} class="py-8 text-center text-sm text-base-content/50">
      <Show
        when={!props.state.error}
        fallback={<span class="text-error">{props.state.error}</span>}
      >
        <Show
          when={props.state.complete}
          fallback={
            <Show
              when={waiting()}
              fallback={
                <span class="inline-flex items-center gap-2">
                  {props.count} results loaded ·
                  <button
                    class="btn btn-sm btn-ghost"
                    onClick={() => setTarget(props.count + props.batch!)}
                  >
                    Load {props.batch} more
                  </button>
                </span>
              }
            >
              <span class="inline-flex items-center gap-2">
                <span class="loading loading-spinner loading-sm" />
                Loading older results…
              </span>
            </Show>
          }
        >
          <Show when={props.count > 0}>
            End of results
            <Show when={props.state.range.since > 0}>
              {" "}
              since {new Date(props.state.range.since * 1000).toLocaleString()}
            </Show>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
