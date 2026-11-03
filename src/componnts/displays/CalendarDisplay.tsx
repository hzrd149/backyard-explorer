import type { NostrEvent } from "nostr-tools";
import { createMemo, createSignal, For, Show } from "solid-js";
import { CALENDAR_KINDS } from "../../services/DisplayService";
import LazyImage from "../previews/LazyImage";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import HiddenResultsNotice from "./HiddenResultsNotice";
import { eventLink, tagValue } from "./format";
import type { DisplayProps } from "./types";

interface Happening {
  event: NostrEvent;
  title: string;
  /** Unix time, or midnight local time for all-day events */
  start?: number;
  end?: number;
  allDay: boolean;
  /** Local day the event starts on, YYYY-MM-DD */
  day?: string;
  timezone?: string;
  location?: string;
  summary?: string;
  image?: string;
  status?: string;
  type: string;
}

const TYPES: Record<number, string> = {
  31922: "All-day event",
  31923: "Event",
  30311: "Live stream",
  30312: "Room",
  30313: "Conference",
};

const pad = (n: number) => String(n).padStart(2, "0");
const localDay = (time: number) => {
  const d = new Date(time * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** Midnight local time of a YYYY-MM-DD date, so all-day events don't shift a day */
const parseDay = (value?: string) => {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).valueOf() / 1000 : undefined;
};
const parseTime = (value?: string) => {
  const n = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const cache = new WeakMap<NostrEvent, Happening>();

function toHappening(event: NostrEvent): Happening {
  let item = cache.get(event);
  if (item) return item;

  const allDay = event.kind === 31922;
  const start = allDay
    ? parseDay(tagValue(event, "start"))
    : parseTime(tagValue(event, "start") ?? tagValue(event, "starts"));
  const end = allDay
    ? parseDay(tagValue(event, "end"))
    : parseTime(tagValue(event, "end") ?? tagValue(event, "ends"));

  item = {
    event,
    title:
      tagValue(event, "title") ??
      tagValue(event, "room") ??
      tagValue(event, "name") ??
      "Untitled",
    start,
    end,
    allDay,
    day: start !== undefined ? localDay(start) : undefined,
    timezone: tagValue(event, "start_tzid"),
    location: tagValue(event, "location"),
    summary:
      tagValue(event, "summary") ??
      (event.kind >= 31922 ? event.content : undefined),
    image: tagValue(event, "image"),
    status: tagValue(event, "status"),
    type: TYPES[event.kind] ?? `Kind ${event.kind}`,
  };
  cache.set(event, item);
  return item;
}

const now = () => Date.now() / 1000;

/** A live stream or room counts as live only while its status says so and it is recent */
const isLive = (item: Happening) =>
  (item.status === "live" || item.status === "open") &&
  item.event.created_at > now() - 2 * 24 * 60 * 60;

/** An event is past once it has ended, or a day after it started without an end */
const isPast = (item: Happening) => {
  if (item.status === "ended" || item.status === "closed") return true;
  if (item.start === undefined) return true;
  const end = item.end ?? item.start + (item.allDay ? 24 * 60 * 60 : 60 * 60);
  return end < now();
};

function dayLabel(day: string) {
  const today = localDay(now());
  const tomorrow = localDay(now() + 24 * 60 * 60);
  const yesterday = localDay(now() - 24 * 60 * 60);
  if (day === today) return "Today";
  if (day === tomorrow) return "Tomorrow";
  if (day === yesterday) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function timeLabel(item: Happening) {
  if (item.allDay || item.start === undefined) return "All day";
  const fmt = (t: number) =>
    new Date(t * 1000).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  return item.end && item.end > item.start
    ? `${fmt(item.start)} – ${fmt(item.end)}`
    : fmt(item.start);
}

/** Group items by the day they start on, keeping the given order */
function byDay(items: Happening[]) {
  const days = new Map<string, Happening[]>();
  for (const item of items) {
    const key = item.day ?? "";
    const list = days.get(key) ?? [];
    list.push(item);
    days.set(key, list);
  }
  return [...days];
}

/**
 * Agenda of calendar events (NIP-52) and live events (NIP-53), ordered by
 * when they happen rather than when they were published.
 */
export default function CalendarDisplay(props: DisplayProps) {
  const items = createMemo(() =>
    props.events
      .filter((e) => CALENDAR_KINDS.includes(e.kind))
      .map(toHappening),
  );
  const live = createMemo(() => items().filter(isLive));
  const upcoming = createMemo(() =>
    items()
      .filter((i) => !isLive(i) && !isPast(i))
      .sort((a, b) => a.start! - b.start!),
  );
  const past = createMemo(() =>
    items()
      .filter((i) => !isLive(i) && isPast(i))
      .sort((a, b) => (b.start ?? 0) - (a.start ?? 0)),
  );

  const [tab, setTab] = createSignal<"upcoming" | "past">();
  const current = () =>
    tab() ??
    (upcoming().length > 0 || past().length === 0 ? "upcoming" : "past");
  const shown = () => (current() === "upcoming" ? upcoming() : past());

  return (
    <div class="space-y-6">
      <Show when={live().length > 0}>
        <section>
          <h3 class="mb-2 flex items-center gap-2 font-semibold">
            <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
            Happening now
          </h3>
          <div class="space-y-2">
            <For each={live()}>{(item) => <Entry item={item} />}</For>
          </div>
        </section>
      </Show>

      <div role="tablist" class="tabs tabs-box w-fit">
        <button
          role="tab"
          class="tab"
          classList={{ "tab-active": current() === "upcoming" }}
          onClick={() => setTab("upcoming")}
        >
          Upcoming ({upcoming().length})
        </button>
        <button
          role="tab"
          class="tab"
          classList={{ "tab-active": current() === "past" }}
          onClick={() => setTab("past")}
        >
          Past ({past().length})
        </button>
      </div>

      <Show when={!props.complete && items().length > 0}>
        <p class="text-sm text-base-content/60">
          Results load newest-published first, so events published earlier can
          still appear in this list as you scroll.
        </p>
      </Show>

      <For each={byDay(shown())}>
        {([day, entries]) => (
          <section>
            <h3 class="sticky top-0 z-10 mb-2 bg-base-200/90 py-1 text-sm font-semibold text-base-content/70 backdrop-blur">
              {day ? dayLabel(day) : "No date"}
            </h3>
            <div class="space-y-2">
              <For each={entries}>{(item) => <Entry item={item} />}</For>
            </div>
          </section>
        )}
      </For>

      <Show
        when={props.complete && shown().length === 0 && live().length === 0}
      >
        <p class="text-center text-base-content/50 mt-8">
          No {current()} events in these results.
        </p>
      </Show>
      <HiddenResultsNotice count={props.events.length - items().length} />
    </div>
  );
}

function Entry(props: { item: Happening }) {
  const item = () => props.item;
  const otherZone = () => {
    const zone = item().timezone;
    return zone && zone !== Intl.DateTimeFormat().resolvedOptions().timeZone
      ? zone
      : undefined;
  };

  return (
    <div class="card card-side border border-base-300 bg-base-100 shadow-sm transition-shadow hover:shadow-md">
      <div class="flex w-28 shrink-0 flex-col justify-center border-r border-base-300 p-3 text-sm sm:w-36">
        <span class="font-semibold tabular-nums">{timeLabel(item())}</span>
        <Show when={otherZone()}>
          <span class="text-xs text-base-content/50">{otherZone()}</span>
        </Show>
      </div>
      <div class="card-body min-w-0 gap-1 p-3">
        <div class="flex flex-wrap items-center gap-2">
          <h4 class="font-semibold">
            <a href={eventLink(item().event)} class="hover:underline">
              {item().title}
            </a>
          </h4>
          <Show when={isLive(item())}>
            <span class="badge badge-error badge-sm">LIVE</span>
          </Show>
          <Show when={item().status === "planned"}>
            <span class="badge badge-ghost badge-sm">planned</span>
          </Show>
          <span class="badge badge-outline badge-sm">{item().type}</span>
        </div>
        <Show when={item().location}>
          <div class="truncate text-sm text-base-content/70">
            📍 {item().location}
          </div>
        </Show>
        <Show when={item().summary}>
          <p class="line-clamp-2 text-sm text-base-content/70">
            {item().summary}
          </p>
        </Show>
        <div class="mt-1 flex items-center gap-1.5 text-xs text-base-content/60">
          <UserAvatar pubkey={item().event.pubkey} size="xs" />
          <UserName pubkey={item().event.pubkey} maxLength={20} />
        </div>
      </div>
      <Show when={item().image}>
        <figure class="hidden w-32 shrink-0 sm:block">
          <LazyImage
            src={item().image}
            alt=""
            class="h-full w-full object-cover"
            placeholderClass="h-full w-full rounded-none"
          />
        </figure>
      </Show>
    </div>
  );
}
