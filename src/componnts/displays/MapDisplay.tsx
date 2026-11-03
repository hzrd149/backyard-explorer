import type { NostrEvent } from "nostr-tools";
import type * as Leaflet from "leaflet";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { getEventLocation, type GeoPoint } from "../../services/Geohash";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import HiddenResultsNotice from "./HiddenResultsNotice";
import { eventLink, formatDate, tagValue } from "./format";
import type { DisplayProps } from "./types";

interface Place {
  event: NostrEvent;
  point: GeoPoint;
  title: string;
  type: string;
}

const TYPES: Record<number, string> = {
  37516: "Geocache",
  7516: "Geocache log",
  30402: "Listing",
  31922: "Event",
  31923: "Event",
  1: "Note",
  20: "Picture",
};

function placeTitle(event: NostrEvent) {
  return (
    tagValue(event, "name") ??
    tagValue(event, "title") ??
    tagValue(event, "summary") ??
    (event.content.slice(0, 80) || "Untitled")
  );
}

/** Theme colour for the markers, Leaflet needs a concrete value rather than a CSS variable */
function themeColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/**
 * Places from any results with `g` geohash tags (geocaches, listings, calendar
 * events, notes) on an OpenStreetMap map, with a list of them alongside.
 */
export default function MapDisplay(props: DisplayProps) {
  const places = createMemo(() => {
    const list: Place[] = [];
    for (const event of props.events) {
      const point = getEventLocation(event);
      if (point)
        list.push({
          event,
          point,
          title: placeTitle(event),
          type: TYPES[event.kind] ?? `Kind ${event.kind}`,
        });
    }
    return list;
  });

  const [selected, setSelected] = createSignal<NostrEvent | null>(null);
  const [failed, setFailed] = createSignal(false);
  let container: HTMLDivElement | undefined;
  let listEl: HTMLUListElement | undefined;
  let map: Leaflet.Map | undefined;
  let L: typeof Leaflet | undefined;
  const markers = new Map<NostrEvent, Leaflet.CircleMarker>();
  // Stop fitting the map to the results once the user has moved it
  let userMoved = false;
  const [ready, setReady] = createSignal(false);

  onMount(async () => {
    try {
      // Only load the map library when a map is shown
      const [leaflet] = await Promise.all([
        import("leaflet"),
        import("leaflet/dist/leaflet.css"),
      ]);
      L = leaflet.default ?? leaflet;
      if (!container) return;
      map = L.map(container, { worldCopyJump: true }).setView([20, 0], 2);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      // Programmatic fits fire Leaflet's move events too, so watch for input instead
      const moved = () => (userMoved = true);
      container.addEventListener("pointerdown", moved, { passive: true });
      container.addEventListener("wheel", moved, { passive: true });
      setReady(true);
    } catch (error) {
      console.error("Failed to load map:", error);
      setFailed(true);
    }
  });
  onCleanup(() => {
    map?.remove();
    markers.clear();
  });

  // Add markers for newly loaded places, keeping existing ones
  createEffect(
    on([places, ready], ([list, isReady]) => {
      if (!isReady || !map || !L) return;
      const color = themeColor("--color-primary", "#605dff");
      let added = false;
      for (const place of list) {
        if (markers.has(place.event)) continue;
        const marker = L.circleMarker([place.point.lat, place.point.lon], {
          radius: 7,
          weight: 2,
          color: "#ffffff",
          fillColor: color,
          fillOpacity: 0.9,
        })
          .bindTooltip(place.title)
          .on("click", () => select(place.event, false))
          .addTo(map);
        markers.set(place.event, marker);
        added = true;
      }
      if (added && !userMoved && list.length > 0) {
        const bounds = L.latLngBounds(
          list.map((p) => [p.point.lat, p.point.lon] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
      }
    }),
  );

  // Highlight the selected place
  createEffect(
    on(selected, (event, previous) => {
      if (previous)
        markers.get(previous)?.setStyle({ radius: 7, color: "#ffffff" });
      const marker = event && markers.get(event);
      if (marker) {
        marker.setStyle({
          radius: 11,
          color: themeColor("--color-accent", "#000"),
        });
        marker.bringToFront();
      }
    }),
  );

  const select = (event: NostrEvent, fly: boolean) => {
    setSelected(event);
    const marker = markers.get(event);
    if (fly && marker && map) {
      userMoved = true;
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 12), {
        duration: 0.6,
      });
    }
    if (!fly)
      listEl
        ?.querySelector(`[data-id="${event.id}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <>
      <div class="grid gap-3 lg:grid-cols-[1fr_22rem]">
        <div class="relative h-[60vh] overflow-hidden rounded-box border border-base-300 bg-base-300 lg:h-[70vh]">
          <div ref={container} class="h-full w-full" />
          <Show when={failed()}>
            <div class="absolute inset-0 flex items-center justify-center text-sm text-error">
              The map failed to load.
            </div>
          </Show>
        </div>
        <ul
          ref={listEl}
          class="max-h-[40vh] space-y-1 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-2 lg:max-h-[70vh]"
        >
          <For
            each={places()}
            fallback={
              <li class="p-4 text-center text-sm text-base-content/50">
                {props.complete
                  ? "No results with a location."
                  : "Looking for results with a location…"}
              </li>
            }
          >
            {(place) => (
              <li
                data-id={place.event.id}
                class="cursor-pointer rounded-lg p-2 hover:bg-base-200"
                classList={{
                  "bg-base-200 ring-1 ring-primary": selected() === place.event,
                }}
                onClick={() => select(place.event, true)}
              >
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium">
                    {place.title}
                  </span>
                  <span class="badge badge-ghost badge-xs ml-auto shrink-0">
                    {place.type}
                  </span>
                </div>
                <div class="mt-1 flex items-center gap-1.5 text-xs text-base-content/60">
                  <UserAvatar pubkey={place.event.pubkey} size="xs" />
                  <UserName
                    pubkey={place.event.pubkey}
                    maxLength={16}
                    clickable={false}
                  />
                  <span class="ml-auto">
                    {formatDate(place.event.created_at)}
                  </span>
                </div>
                <Show when={selected() === place.event}>
                  <div class="mt-2 flex items-center justify-between text-xs">
                    <code class="text-base-content/50">
                      {place.point.lat.toFixed(4)}, {place.point.lon.toFixed(4)}
                    </code>
                    <a href={eventLink(place.event)} class="link link-primary">
                      Open event
                    </a>
                  </div>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </div>
      <p class="mt-2 text-xs text-base-content/50">
        Map tiles are loaded from OpenStreetMap.
      </p>
      <HiddenResultsNotice count={props.events.length - places().length} />
    </>
  );
}
