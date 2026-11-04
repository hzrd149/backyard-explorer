import { createMemo, createSignal, from, Show, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { tryPlanQuery } from "../../services/QueryPlanner";
import {
  getDisplayModeInfo,
  resolveDisplayMode,
} from "../../services/DisplayService";
import type { FeedState, TimelineFeed } from "../../services/TimelineFeed";
import DisplaySwitcher from "./DisplaySwitcher";
import FeedSentinel from "./FeedSentinel";
import ResultFilterBar from "./ResultFilterBar";
import {
  applyResultFilters,
  kindFacets,
  loadFilterSettings,
  saveFilterSettings,
  type ResultFilterSettings,
} from "../../services/ResultFilters";
import { DISPLAY_COMPONENTS, NARROW_MODES } from "./index";

interface ResultsDisplayProps {
  /** The feed for one search, it loads more events as the results are scrolled */
  feed: TimelineFeed;
  query: string;
  /** Shown when the feed finished without finding anything */
  empty: JSX.Element;
}

/** Events loaded per request in views whose page doesn't grow with their results */
const BOUNDED_BATCH = 500;

const INITIAL_STATE: FeedState = {
  loading: true,
  complete: false,
  range: { since: 0, until: 0 },
};

/**
 * Renders search results using the display mode chosen with `view:` or
 * inferred from the query. Display modes never change what is fetched, and
 * switching between them keeps the loaded results.
 */
export default function ResultsDisplay(props: ResultsDisplayProps) {
  // The feed is fixed for the lifetime of this component, App re-creates it per search
  const events = from(props.feed.events$, []);
  const state = from(props.feed.state$, INITIAL_STATE);

  const plan = createMemo(
    () => tryPlanQuery(props.query) ?? { kinds: [], mimeTypes: [] },
  );
  const resolved = createMemo(() => resolveDisplayMode(plan()));

  // Client-side filters over the loaded results; they never change what is fetched
  const [settings, setSettings] = createSignal(loadFilterSettings());
  const [text, setText] = createSignal("");
  const updateSettings = (next: ResultFilterSettings) => {
    setSettings(next);
    saveFilterSettings(next);
  };
  const filtered = createMemo(() =>
    applyResultFilters(events(), settings(), text()),
  );
  const facets = createMemo(() => kindFacets(events()));
  const narrow = () => NARROW_MODES.includes(resolved().mode);
  const bounded = () => getDisplayModeInfo(resolved().mode).bounded;
  const empty = () => events().length === 0 && state().complete;

  return (
    <div class="mx-auto" classList={{ "max-w-4xl": narrow() }}>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-2xl font-bold">
          {filtered().visible.length}
          <Show when={!state().complete && filtered().hidden === 0}>
            +
          </Show>{" "}
          result
          {filtered().visible.length !== 1 ? "s" : ""}
          <Show when={filtered().hidden > 0}>
            <span class="text-base font-normal text-base-content/50">
              {" "}
              of {events().length}
              <Show when={!state().complete}>+</Show> loaded
            </span>
          </Show>
        </h2>
        <DisplaySwitcher query={props.query} resolved={resolved()} />
      </div>
      <Show when={events().length > 0}>
        <ResultFilterBar
          settings={settings()}
          onChange={updateSettings}
          text={text()}
          onText={setText}
          result={filtered()}
          facets={facets()}
          queryKinds={plan().kinds}
        />
      </Show>
      <Show when={!empty()} fallback={props.empty}>
        <Dynamic
          component={DISPLAY_COMPONENTS[resolved().mode]}
          events={filtered().visible}
          complete={state().complete}
        />
      </Show>
      <FeedSentinel
        feed={props.feed}
        state={state()}
        count={events().length}
        batch={bounded() ? BOUNDED_BATCH : undefined}
      />
    </div>
  );
}
