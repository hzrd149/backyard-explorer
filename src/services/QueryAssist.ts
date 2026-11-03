/**
 * Editor helpers for the search box: the token under the cursor, completions for
 * it, a plain-language summary of a plan and the equivalent `nak req` command.
 *
 * Everything here is synchronous and free of browser APIs; person lookups for
 * `by:` / `mentions:` happen in the component.
 */
import type { Filter } from "applesauce-core/helpers";
import { DISPLAY_MODES } from "./DisplayService";
import { EVENT_KIND_MAP, type QueryPlan } from "./QueryPlanner";

export interface CursorToken {
  /** The token text from its start up to its end (not just to the cursor) */
  text: string;
  start: number;
  end: number;
  /** Lowercased field name when the token is `name:value` */
  field?: string;
  /** The value after the colon, for fields */
  value?: string;
}

export interface Suggestion {
  /** Text shown in the list */
  label: string;
  /** Replaces the token under the cursor */
  insert: string;
  detail?: string;
}

/** A field the search box knows how to complete */
interface FieldHelp {
  name: string;
  detail: string;
  /** Example inserted after the colon when nothing is typed yet */
  values?: () => Suggestion[];
}

const TOKEN_BREAK = /[\s()"]/;

/** The whitespace-delimited token touching the cursor, if any */
export function tokenAtCursor(
  query: string,
  cursor: number,
): CursorToken | undefined {
  let start = cursor;
  while (start > 0 && !TOKEN_BREAK.test(query[start - 1])) start--;
  let end = cursor;
  while (end < query.length && !TOKEN_BREAK.test(query[end])) end++;
  if (start === end) return undefined;

  const text = query.slice(start, end);
  const colon = text.indexOf(":");
  if (colon > 0 && /^[a-z][a-z0-9_-]*$/i.test(text.slice(0, colon))) {
    return {
      text,
      start,
      end,
      field: text.slice(0, colon).toLowerCase(),
      value: text.slice(colon + 1),
    };
  }
  return { text, start, end };
}

const RELATIVE_DATES: [string, string][] = [
  ["12h", "last 12 hours"],
  ["1d", "since yesterday"],
  ["3d", "last 3 days"],
  ["1w", "last week"],
  ["1m", "last month"],
  ["1y", "last year"],
];

const HAS_VALUES: [string, string][] = [
  ["image", "image attachments"],
  ["video", "video attachments"],
  ["audio", "audio attachments"],
  ["gif", "animated GIFs"],
  ["pdf", "PDF documents"],
];

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function dateValues(field: string, now: Date): Suggestion[] {
  const values = RELATIVE_DATES.map(([value, detail]) => ({
    label: `${field}:${value}`,
    insert: `${field}:${value}`,
    detail,
  }));
  values.push({
    label: `${field}:${isoDay(now)}`,
    insert: `${field}:${isoDay(now)}`,
    detail: "a date (UTC)",
  });
  return values;
}

/** Kind names grouped by the kinds they map to, so `note` and `text` show once */
function kindNames(): Suggestion[] {
  return Object.entries(EVENT_KIND_MAP).map(([name, kinds]) => ({
    label: `is:${name}`,
    insert: `is:${name}`,
    detail: `kind ${Array.isArray(kinds) ? kinds.join(", ") : kinds}`,
  }));
}

function viewNames(): Suggestion[] {
  return DISPLAY_MODES.map((mode) => ({
    label: `view:${mode.id}`,
    insert: `view:${mode.id}`,
    detail: `${mode.icon} ${mode.label}`,
  }));
}

function fieldsHelp(now: Date): FieldHelp[] {
  return [
    { name: "is", detail: "event type, is:article", values: kindNames },
    { name: "kind", detail: "event kind numbers, kind:1,6" },
    { name: "by", detail: "author name or npub, by:(alice OR bob)" },
    { name: "mentions", detail: "events tagging a person" },
    {
      name: "since",
      detail: "newer than, since:3d",
      values: () => dateValues("since", now),
    },
    {
      name: "until",
      detail: "older than, until:2024-01-01",
      values: () => dateValues("until", now),
    },
    {
      name: "has",
      detail: "attachment type, has:image",
      values: () =>
        HAS_VALUES.map(([value, detail]) => ({
          label: `has:${value}`,
          insert: `has:${value}`,
          detail,
        })),
    },
    { name: "m", detail: "MIME type or extension, m:image/ m:pdf" },
    { name: "t", detail: "any tag, t:d=my-article" },
    { name: "e", detail: "events referencing an event id" },
    { name: "limit", detail: "most results to show, limit:50" },
    { name: "view", detail: "display mode, view:images", values: viewNames },
    { name: "p", detail: "look up profiles by name" },
  ];
}

const MAX_SUGGESTIONS = 8;

/**
 * Completions for the token under the cursor: field names while typing a bare
 * word, then known values once the colon is typed.
 */
export function suggest(
  query: string,
  cursor: number,
  now = new Date(),
): { token: CursorToken; suggestions: Suggestion[] } | undefined {
  const token = tokenAtCursor(query, cursor);
  if (!token) return undefined;
  const fields = fieldsHelp(now);

  let suggestions: Suggestion[] = [];
  if (token.field !== undefined) {
    const help = fields.find((f) => f.name === token.field);
    const typed = token.text.toLowerCase();
    suggestions =
      help
        ?.values?.()
        .filter(
          (s) =>
            s.insert.toLowerCase().startsWith(typed) && s.insert !== token.text,
        ) ?? [];
  } else if (/^[a-z]+$/i.test(token.text)) {
    const typed = token.text.toLowerCase();
    suggestions = fields
      .filter((f) => f.name.startsWith(typed))
      .map((f) => ({
        label: `${f.name}:`,
        insert: `${f.name}:`,
        detail: f.detail,
      }));
  }

  if (suggestions.length === 0) return undefined;
  return { token, suggestions: suggestions.slice(0, MAX_SUGGESTIONS) };
}

/** Replace the token with a suggestion, returning the new query and cursor */
export function applySuggestion(
  query: string,
  token: CursorToken,
  insert: string,
): { query: string; cursor: number } {
  // Completed values get a trailing space so the next term can be typed straight away
  const done = !insert.endsWith(":");
  const after = query.slice(token.end);
  const spacer = done && !/^\s/.test(after) ? " " : "";
  const next = query.slice(0, token.start) + insert + spacer + after;
  return { query: next, cursor: token.start + insert.length + spacer.length };
}

// ---------------------------------------------------------------------------
// Plan summaries

const KIND_NAMES: Record<number, string> = {
  0: "profiles",
  1: "notes",
  3: "follow lists",
  6: "reposts",
  7: "reactions",
  16: "reposts",
  20: "pictures",
  21: "videos",
  22: "short videos",
  1063: "files",
  1111: "comments",
  9735: "zaps",
  9802: "highlights",
  30023: "articles",
  30311: "live events",
  34235: "videos",
  34236: "short videos",
};

const short = (value: string) =>
  /^[0-9a-f]{64}$/i.test(value) ? `${value.slice(0, 8)}…` : value;

const time = (seconds: number) =>
  new Date(seconds * 1000)
    .toISOString()
    .replace(".000Z", "Z")
    .replace("T00:00:00Z", "");

function describeKinds(kinds: number[]): string {
  const names = [...new Set(kinds.map((k) => KIND_NAMES[k] ?? `kind ${k}`))];
  return names.length > 4
    ? `${names.slice(0, 3).join(", ")} +${names.length - 3}`
    : names.join(", ");
}

function list(values: string[], max = 3): string {
  const shown = values.slice(0, max).map(short).join(", ");
  return values.length > max ? `${shown} +${values.length - max}` : shown;
}

/** One short line describing a filter, e.g. `notes · #nostr · since 2024-01-01` */
export function describeFilter(filter: Filter, pending: string[] = []): string {
  const parts: string[] = [];
  if (filter.ids) parts.push(`id ${list(filter.ids)}`);
  if (filter.kinds) parts.push(describeKinds(filter.kinds));
  if (filter.search) parts.push(`“${filter.search}”`);
  if (filter.authors) parts.push(`by ${list(filter.authors)}`);
  if (pending.length) parts.push(`by ${list(pending)}`);

  for (const [key, raw] of Object.entries(filter)) {
    if (!key.startsWith("#") || !Array.isArray(raw)) continue;
    const values = raw.map(String);
    const tag = key.slice(1);
    if (tag === "t") parts.push(values.map((v) => `#${v}`).join(" or "));
    else if (tag === "p") parts.push(`mentions ${list(values)}`);
    else if (tag === "m") parts.push(`type ${list(values)}`);
    else parts.push(`${tag}=${list(values)}`);
  }

  if (filter.since !== undefined) parts.push(`since ${time(filter.since)}`);
  if (filter.until !== undefined) parts.push(`until ${time(filter.until)}`);
  return parts.join(" · ") || "everything";
}

/** One line per OR branch */
export function describePlan(plan: QueryPlan): string[] {
  if (plan.profileLookup.length) {
    return [
      `profiles named ${plan.profileLookup.map((p) => `“${p}”`).join(" or ")}`,
    ];
  }
  return plan.branches.map((branch) =>
    describeFilter(
      branch.filter,
      branch.pending
        .filter((c) => c.target === "authors")
        .flatMap((c) => c.values),
    ),
  );
}

// ---------------------------------------------------------------------------
// nak

const quote = (value: string) =>
  /^[\w.:/@=+-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;

/** The `nak req` command for one filter */
export function nakCommand(filter: Filter, relay: string): string {
  const args = ["nak", "req"];
  for (const kind of filter.kinds ?? []) args.push("-k", String(kind));
  for (const author of filter.authors ?? []) args.push("-a", author);
  for (const id of filter.ids ?? []) args.push("-i", id);
  for (const [key, values] of Object.entries(filter)) {
    if (!key.startsWith("#") || !Array.isArray(values)) continue;
    for (const value of values)
      args.push("-t", quote(`${key.slice(1)}=${value}`));
  }
  if (filter.since !== undefined) args.push("--since", String(filter.since));
  if (filter.until !== undefined) args.push("--until", String(filter.until));
  if (filter.limit !== undefined) args.push("-l", String(filter.limit));
  if (filter.search) args.push("--search", quote(filter.search));
  args.push(relay);
  return args.join(" ");
}

/** One `nak req` line per filter */
export function nakCommands(filters: Filter[], relay: string): string {
  return filters.map((f) => nakCommand(f, relay)).join("\n");
}
