import { For, onCleanup } from "solid-js";
import EventCard from "../events/EventCard";
import { openEventDetails } from "../EventDetails";
import type { DisplayProps } from "./types";

/** True when a key press belongs to a text field rather than the page */
const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** The default feed: every event rendered with its kind-specific card */
export default function TimelineDisplay(props: DisplayProps) {
  let list: HTMLDivElement | undefined;

  // j / k move between results, Enter or o opens the focused one's details
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (e.key !== "j" && e.key !== "k") return;
    if (document.querySelector(".modal-open")) return;
    const items = [
      ...(list?.querySelectorAll<HTMLElement>("[data-result]") ?? []),
    ];
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      index < 0
        ? 0
        : Math.min(
            items.length - 1,
            Math.max(0, index + (e.key === "j" ? 1 : -1)),
          );
    e.preventDefault();
    items[next].focus({ preventScroll: true });
    items[next].scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  window.addEventListener("keydown", onKey);
  onCleanup(() => window.removeEventListener("keydown", onKey));

  return (
    <div ref={list} class="space-y-4">
      <For each={props.events}>
        {(event) => (
          // Let the browser skip layout and paint for cards far off screen
          <div
            data-result
            tabindex="-1"
            class="group relative rounded-box outline-none focus-visible:ring-2 focus:ring-2 ring-primary [content-visibility:auto] [contain-intrinsic-size:auto_320px]"
            onKeyDown={(e) => {
              if (
                (e.key === "Enter" || e.key === "o") &&
                e.target === e.currentTarget
              ) {
                e.preventDefault();
                openEventDetails(event);
              }
            }}
          >
            <EventCard event={event} />
            <button
              class="btn btn-xs btn-ghost absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 focus:opacity-100"
              title="Event details (Enter)"
              onClick={() => openEventDetails(event)}
            >
              {"{ }"} details
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
