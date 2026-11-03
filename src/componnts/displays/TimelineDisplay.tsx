import { For } from "solid-js";
import EventCard from "../events/EventCard";
import type { DisplayProps } from "./types";

/** The default feed: every event rendered with its kind-specific card */
export default function TimelineDisplay(props: DisplayProps) {
  return (
    <div class="space-y-4">
      <For each={props.events}>{(event) => <EventCard event={event} />}</For>
    </div>
  );
}
