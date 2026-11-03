import { npubEncode } from "nostr-tools/nip19";
import { createMemo, createSignal, For, Show, type JSX } from "solid-js";
import {
  getZapAmount,
  getZapRecipient,
  getZapSender,
  isValidZap,
} from "applesauce-common/helpers";
import { EVENT_KIND_MAP } from "../../services/QueryPlanner";
import { useSearch } from "../../context/SearchContext";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import { formatDate, formatDateTime, tagValue } from "./format";
import type { DisplayProps } from "./types";

const HOUR = 60 * 60;
const DAY = 24 * HOUR;
/** Bucket sizes for the activity chart, the smallest that fits MAX_BUCKETS is used */
const BUCKETS = [
  { size: HOUR, label: "hour" },
  { size: 6 * HOUR, label: "6 hours" },
  { size: DAY, label: "day" },
  { size: 7 * DAY, label: "week" },
  { size: 30 * DAY, label: "30 days" },
  { size: 365 * DAY, label: "year" },
];
const MAX_BUCKETS = 60;
const TOP = 10;

/** A readable name for each kind, the first alias the query syntax knows it by */
const KIND_NAMES = new Map<number, string>();
for (const [name, value] of Object.entries(EVENT_KIND_MAP)) {
  if (typeof value === "number" && !KIND_NAMES.has(value))
    KIND_NAMES.set(value, name.replace(/_/g, " "));
}

function countBy<T>(
  items: T[],
  key: (item: T) => string[] | string | undefined,
) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const keys = key(item);
    for (const k of Array.isArray(keys) ? keys : keys ? [keys] : []) {
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return top(counts);
}

function top(counts: Map<string, number>) {
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([key, value]) => ({ key, value }));
}

const number = (value: number) => value.toLocaleString();

/**
 * Summary of the loaded results: activity over time and the top authors,
 * hashtags, kinds and clients. Clicking an entry narrows the search to it.
 */
export default function StatsDashboard(props: DisplayProps) {
  const { appendToSearch } = useSearch();

  const authors = createMemo(() => countBy(props.events, (e) => e.pubkey));
  const authorCount = createMemo(
    () => new Set(props.events.map((e) => e.pubkey)).size,
  );
  const hashtags = createMemo(() =>
    countBy(props.events, (e) => [
      ...new Set(
        e.tags
          .filter((t) => t[0] === "t" && t[1])
          .map((t) => t[1].toLowerCase()),
      ),
    ]),
  );
  const kinds = createMemo(() => countBy(props.events, (e) => String(e.kind)));
  const clients = createMemo(() =>
    countBy(props.events, (e) => tagValue(e, "client")),
  );
  const mentions = createMemo(() =>
    countBy(props.events, (e) => [
      ...new Set(e.tags.filter((t) => t[0] === "p" && t[1]).map((t) => t[1])),
    ]),
  );

  const zaps = createMemo(() => {
    const valid = props.events.filter((e) => e.kind === 9735 && isValidZap(e));
    const senders = new Map<string, number>();
    const recipients = new Map<string, number>();
    let total = 0;
    for (const zap of valid) {
      const sats = Math.floor((getZapAmount(zap) ?? 0) / 1000);
      total += sats;
      const sender = getZapSender(zap);
      const recipient = getZapRecipient(zap);
      if (sender) senders.set(sender, (senders.get(sender) ?? 0) + sats);
      if (recipient)
        recipients.set(recipient, (recipients.get(recipient) ?? 0) + sats);
    }
    return {
      count: valid.length,
      total,
      senders: top(senders),
      recipients: top(recipients),
    };
  });

  const activity = createMemo(() => {
    const events = props.events;
    if (events.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const e of events) {
      if (e.created_at < min) min = e.created_at;
      if (e.created_at > max) max = e.created_at;
    }
    const span = Math.max(1, max - min);
    const bucket =
      BUCKETS.find((b) => span / b.size <= MAX_BUCKETS) ??
      BUCKETS[BUCKETS.length - 1];
    const start = Math.floor(min / bucket.size) * bucket.size;
    const counts = new Array<number>(
      Math.floor((max - start) / bucket.size) + 1,
    ).fill(0);
    for (const e of events)
      counts[Math.floor((e.created_at - start) / bucket.size)]++;
    return {
      min,
      max,
      bucket,
      peak: Math.max(...counts),
      bars: counts.map((count, i) => ({
        start: start + i * bucket.size,
        count,
      })),
    };
  });

  const [hovered, setHovered] = createSignal<number | null>(null);
  const [showTable, setShowTable] = createSignal(false);

  const person = (pubkey: string) => (
    <span class="flex min-w-0 items-center gap-1.5">
      <UserAvatar pubkey={pubkey} size="xs" />
      <UserName pubkey={pubkey} maxLength={22} clickable={false} />
    </span>
  );

  return (
    <div class="space-y-6">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="Results"
          value={`${number(props.events.length)}${props.complete ? "" : "+"}`}
        />
        <Tile label="Authors" value={number(authorCount())} />
        <Tile
          label="Time span"
          value={
            activity()
              ? `${formatDate(activity()!.min)} – ${formatDate(activity()!.max)}`
              : "—"
          }
          small
        />
        <Show
          when={zaps().count > 0}
          fallback={
            <Tile label="Hashtags used" value={number(hashtags().length)} />
          }
        >
          <Tile
            label={`Zapped in ${number(zaps().count)} zaps`}
            value={`${number(zaps().total)} sats`}
          />
        </Show>
      </div>

      <Show when={!props.complete}>
        <p class="text-sm text-base-content/60">
          Based on the {number(props.events.length)} newest results loaded so
          far. Load more below to include older ones.
        </p>
      </Show>

      <Show when={activity()}>
        {(chart) => (
          <section class="card border border-base-300 bg-base-100 p-4">
            <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="font-semibold">
                Activity{" "}
                <span class="text-sm font-normal text-base-content/60">
                  results per {chart().bucket.label}
                </span>
              </h3>
              <span class="text-sm text-base-content/70 tabular-nums">
                <Show
                  when={hovered() !== null && chart().bars[hovered()!]}
                  fallback={`Peak ${number(chart().peak)}`}
                >
                  {(bar) =>
                    `${chart().bucket.size < DAY ? formatDateTime(bar().start) : formatDate(bar().start)} · ${number(bar().count)}`
                  }
                </Show>
              </span>
            </div>
            <div class="flex">
              <div class="flex h-40 flex-col justify-between pr-2 text-right text-xs text-base-content/50 tabular-nums">
                <span>{number(chart().peak)}</span>
                <span>0</span>
              </div>
              <div
                class="flex h-40 flex-1 items-end gap-[2px] border-b border-base-300"
                onPointerLeave={() => setHovered(null)}
                role="img"
                aria-label={`Results per ${chart().bucket.label}, peak ${chart().peak}`}
              >
                <For each={chart().bars}>
                  {(bar, i) => (
                    // The hit target is the full column, wider than the bar itself
                    <div
                      class="flex h-full flex-1 items-end"
                      onPointerEnter={() => setHovered(i())}
                    >
                      <div
                        class="w-full rounded-t bg-primary transition-opacity"
                        classList={{
                          "opacity-50": hovered() !== null && hovered() !== i(),
                        }}
                        style={{
                          height: bar.count
                            ? `max(2px, ${(bar.count / chart().peak) * 100}%)`
                            : "0",
                        }}
                      />
                    </div>
                  )}
                </For>
              </div>
            </div>
            <div class="mt-1 flex justify-between pl-8 text-xs text-base-content/50">
              <span>{formatDate(chart().bars[0].start)}</span>
              <span>{formatDate(chart().max)}</span>
            </div>
            <button
              class="link link-hover mt-2 self-start text-xs text-base-content/60"
              onClick={() => setShowTable(!showTable())}
            >
              {showTable() ? "Hide table" : "Show as table"}
            </button>
            <Show when={showTable()}>
              <div class="mt-2 max-h-64 overflow-y-auto">
                <table class="table table-xs">
                  <thead>
                    <tr>
                      <th>Period starting</th>
                      <th class="text-right">Results</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={[...chart().bars].reverse()}>
                      {(bar) => (
                        <tr>
                          <td>{formatDateTime(bar.start)}</td>
                          <td class="text-right tabular-nums">
                            {number(bar.count)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </section>
        )}
      </Show>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RankList
          title="Top authors"
          items={authors()}
          label={person}
          onSelect={(pubkey) => appendToSearch(`by:${npubEncode(pubkey)}`)}
        />
        <RankList
          title="Top hashtags"
          items={hashtags()}
          label={(tag) => <span class="truncate">#{tag}</span>}
          onSelect={(tag) => appendToSearch(`#${tag}`)}
        />
        <RankList
          title="Kinds"
          items={kinds()}
          label={(kind) => (
            <span class="truncate">
              {KIND_NAMES.get(Number(kind)) ?? "kind"}{" "}
              <span class="text-base-content/50">{kind}</span>
            </span>
          )}
          onSelect={(kind) => appendToSearch(`kind:${kind}`)}
        />
        <RankList
          title="Most mentioned"
          items={mentions()}
          label={person}
          onSelect={(pubkey) =>
            appendToSearch(`mentions:${npubEncode(pubkey)}`)
          }
        />
        <RankList
          title="Posting clients"
          items={clients()}
          label={(client) => <span class="truncate">{client}</span>}
        />
        <Show when={zaps().count > 0}>
          <RankList
            title="Top zappers (sats)"
            items={zaps().senders}
            label={person}
          />
          <RankList
            title="Most zapped (sats)"
            items={zaps().recipients}
            label={person}
          />
        </Show>
      </div>
    </div>
  );
}

function Tile(props: { label: string; value: string; small?: boolean }) {
  return (
    <div class="rounded-box border border-base-300 bg-base-100 p-4">
      <div class="text-xs text-base-content/60">{props.label}</div>
      <div
        class="font-bold tabular-nums"
        classList={{ "text-2xl": !props.small, "text-sm mt-1": props.small }}
      >
        {props.value}
      </div>
    </div>
  );
}

interface RankListProps {
  title: string;
  items: { key: string; value: number }[];
  label: (key: string) => JSX.Element;
  /** Narrow the search to an entry */
  onSelect?: (key: string) => void;
}

/** Top entries as horizontal bars, scaled to the largest */
function RankList(props: RankListProps) {
  const max = () => props.items[0]?.value ?? 1;
  return (
    <section class="card border border-base-300 bg-base-100 p-4">
      <h3 class="mb-3 font-semibold">{props.title}</h3>
      <Show
        when={props.items.length > 0}
        fallback={
          <p class="text-sm text-base-content/50">None in these results</p>
        }
      >
        <ol class="space-y-2">
          <For each={props.items}>
            {(item) => (
              <li
                class="group text-sm"
                classList={{ "cursor-pointer": !!props.onSelect }}
                title={props.onSelect ? "Add to search" : undefined}
                onClick={(e) => {
                  // Names and avatars handle their own clicks
                  if ((e.target as HTMLElement).closest("a, button")) return;
                  props.onSelect?.(item.key);
                }}
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="flex min-w-0 items-center group-hover:underline">
                    {props.label(item.key)}
                  </span>
                  <span class="tabular-nums text-base-content/70">
                    {number(item.value)}
                  </span>
                </div>
                <div class="mt-1 h-1.5 rounded-full bg-base-200">
                  <div
                    class="h-full rounded-full bg-primary"
                    style={{ width: `${(item.value / max()) * 100}%` }}
                  />
                </div>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </section>
  );
}
