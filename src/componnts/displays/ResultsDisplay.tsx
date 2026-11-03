import type { NostrEvent } from "nostr-tools";
import { createMemo } from "solid-js";
import { Dynamic } from "solid-js/web";
import { parseQuery } from "../../services/QueryParser";
import { resolveDisplayMode } from "../../services/DisplayService";
import DisplaySwitcher from "./DisplaySwitcher";
import { DISPLAY_COMPONENTS, NARROW_MODES } from "./index";

interface ResultsDisplayProps {
  events: NostrEvent[];
  query: string;
}

/**
 * Renders search results using the display mode chosen with `view:` or
 * inferred from the query. Display modes never change what is fetched.
 */
export default function ResultsDisplay(props: ResultsDisplayProps) {
  const resolved = createMemo(() =>
    resolveDisplayMode(parseQuery(props.query)),
  );
  const narrow = () => NARROW_MODES.includes(resolved().mode);

  return (
    <div class="mx-auto" classList={{ "max-w-4xl": narrow() }}>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-2xl font-bold">
          {props.events.length} result{props.events.length !== 1 ? "s" : ""}
        </h2>
        <DisplaySwitcher query={props.query} resolved={resolved()} />
      </div>
      <Dynamic
        component={DISPLAY_COMPONENTS[resolved().mode]}
        events={props.events}
      />
    </div>
  );
}
