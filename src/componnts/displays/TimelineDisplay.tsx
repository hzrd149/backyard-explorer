import { For } from "solid-js";
import EventCard from "../events/EventCard";
import type { DisplayProps } from "./types";

/** The default feed: every event rendered with its kind-specific card */
export default function TimelineDisplay(props: DisplayProps) {
  return (
    <div class="space-y-4">
      <For each={props.events}>
        {(event) => (
          // Let the browser skip layout and paint for cards far off screen
          <div class="[content-visibility:auto] [contain-intrinsic-size:auto_320px]">
            <EventCard event={event} />
          </div>
        )}
      </For>
    </div>
  );
}
