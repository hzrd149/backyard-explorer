import type { Filter } from "nostr-tools";
import { nip19 } from "nostr-tools";
import mime from "mime";
import { parseDate } from "chrono-node";
import {
  QueryError,
  parseQueryTree,
  type QueryLeaf,
  type QueryNode,
} from "./QueryParser";

export { QueryError } from "./QueryParser";

/** Most OR branches a query may expand into */
export const MAX_BRANCHES = 32;
export const DEFAULT_LIMIT = 500;

// Mapping of event kind names, used by `is:`, to their numbers
export const EVENT_KIND_MAP: Record<string, number | number[]> = {
  // Basic kinds
  note: 1,
  tweet: 1,
  article: 30023,
  blogpost: 30023,
  profile: 0,
  contacts: 3,

  // Common event kinds from NIPs
  metadata: 0,
  text: 1,
  recommend_relay: 2,
  follow: 3,
  follows: 3,
  encrypted_dm: 4,
  deletion: 5,
  delete: 5,
  repost: 6,
  share: 6,
  reaction: 7,
  badge_award: 8,
  chat_message: 9,
  group_chat_reply: 10,
  thread: 11,
  group_thread_reply: 12,
  seal: 13,
  direct_message: 14,
  file_message: 15,
  generic_repost: 16,
  website_reaction: 17,
  picture: 20,
  image: 20,
  images: 20,
  video: [21, 22, 34235, 34236],
  videos: [21, 22, 34235, 34236],
  media: [20, 21, 22, 34235, 34236],
  short_video: 22,
  addressable_video: 34235,
  addressable_short_video: 34236,

  // Other common kinds
  request_vanish: 62,
  chess: 64,
  poll_response: 1018,
  bid: 1021,
  bid_confirmation: 1022,
  opentimestamp: 1040,
  gift_wrap: 1059,
  file: 1063,
  poll: 1068,
  comment: 1111,
  voice_message: 1222,
  voice_comment: 1244,
  live_chat: 1311,
  code: 1337,
  snippet: 1337,
  patch: 1617,
  issue: 1618,
  git_reply: 1622,
  status: 1630,
  problem_tracker: 1971,
  report: 1984,
  label: 1985,
  relay_review: 1986,
  ai_embeddings: 1987,
  torrent: 2003,
  torrent_comment: 2004,
  coinjoin_pool: 2022,
  cashu_reserved: 7374,
  cashu_tokens: 7375,
  cashu_history: 7376,
  geocache_log: 7516,
  geocache_proof: 7517,
  group_control: 9000,
  goal: 9041,
  nutzap: 9321,
  tidal_login: 9467,
  zap_request: 9734,
  zap: 9735,
  highlight: 9802,

  // List kinds
  mutes: 10000,
  mute: 10000,
  muted: 10000,
  pins: 10001,
  pin: 10001,
  relays: 10002,
  bookmarks: 10003,
  bookmark: 10003,
  communities: 10004,
  public_chats: 10005,
  blocked_relays: 10006,
  search_relays: 10007,
  user_groups: 10009,
  favorite_relays: 10012,
  interests: 10015,
  nutzap_mint_recommendation: 10019,
  media_follows: 10020,
  user_emojis: 10030,
  dm_relays: 10050,
  keypackage_relays: 10051,
  user_server_list: 10063,
  relay_monitor: 10166,
  room_presence: 10312,
  proxy_announcement: 10377,
  transport_method: 11111,
  wallet_info: 13194,
  cashu_wallet: 17375,

  // Set kinds
  follow_set: 30000,
  generic_list: 30001,
  relay_set: 30002,
  bookmark_set: 30003,
  curation_set: 30004,
  video_set: 30005,
  kind_mute_set: 30007,
  profile_badge: 30008,
  badge_definition: 30009,
  interest_set: 30015,
  stall: 30017,
  product: 30018,
  marketplace: 30019,
  auction: 30020,
  longform: 30023,
  emoji: 30030,
  curated_publication_index: 30040,
  curated_publication_content: 30041,
  release_artifact_set: 30063,
  app_data: 30078,
  relay_discovery: 30166,
  app_curation_set: 30267,
  live_event: 30311,
  interactive_room: 30312,
  conference_event: 30313,
  user_status: 30315,
  slide_set: 30388,
  classified_listing: 30402,
  draft_classified_listing: 30403,
  repository_announcement: 30617,
  repository_state: 30618,
  wiki_article: 30818,
  redirect: 30819,
  draft_event: 31234,
  link_set: 31388,
  feed: 31890,
  date_calendar_event: 31922,
  time_calendar_event: 31923,
  calendar: 31924,
  calendar_rsvp: 31925,
  handler_recommendation: 31989,
  handler_information: 31990,
  software_application: 32267,
  community_definition: 34550,
  cashu_mint: 38172,
  fedimint: 38173,
  geocache_listing: 37516,
  p2p_order: 38383,
  group_metadata: 39000,
  starter_pack: 39089,
  followpack: 39089,
  media_starter_pack: 39092,
  web_bookmark: 39701,
};

const MIME_PREFIX_EXPANSIONS: Record<string, string[]> = {
  image: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    "image/tiff",
    "image/ico",
    "image/x-icon",
  ],
  video: [
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
    "video/3gp",
    "video/quicktime",
  ],
  audio: [
    "audio/mp3",
    "audio/mpeg",
    "audio/wav",
    "audio/flac",
    "audio/aac",
    "audio/ogg",
    "audio/m4a",
    "audio/wma",
    "audio/opus",
  ],
  text: [
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "text/json",
    "text/xml",
    "text/csv",
    "text/markdown",
    "text/yaml",
  ],
  application: [
    "application/pdf",
    "application/zip",
    "application/json",
    "application/xml",
    "application/javascript",
    "application/octet-stream",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
};

const COMMON_EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  avi: "video/avi",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pdf: "application/pdf",
  zip: "application/zip",
  txt: "text/plain",
  html: "text/html",
  css: "text/css",
  js: "application/javascript",
  json: "application/json",
};

/** `has:` shortcuts, matched against the NIP-94 / imeta `m` tag */
const HAS_MIME: Record<string, string> = {
  image: "image/",
  images: "image/",
  video: "video/",
  videos: "video/",
  audio: "audio/",
  gif: "gif",
  pdf: "pdf",
};

/**
 * Expand a MIME type or file extension to MIME types
 *
 * - File extensions: m:jpg, m:.png, m:pdf
 * - Full MIME types: m:image/jpeg, m:application/pdf
 * - Wildcard MIME types: m:image/ expands to the common image/* types
 */
export function expandMimeType(input: string): string[] {
  const cleanInput = input.startsWith(".") ? input.substring(1) : input;

  if (cleanInput.endsWith("/")) {
    const prefix = cleanInput.slice(0, -1).toLowerCase();
    return MIME_PREFIX_EXPANSIONS[prefix] ?? [`${prefix}/*`];
  }
  if (cleanInput.includes("/")) return [cleanInput.toLowerCase()];

  const type =
    mime.getType(cleanInput) ?? COMMON_EXTENSIONS[cleanInput.toLowerCase()];
  return type ? [type] : [];
}

// ---------------------------------------------------------------------------
// Dates

const RELATIVE_DATE = /^(\d+)([hdwmy])$/i;
const ABSOLUTE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86400;

/**
 * Parse a since:/until: value into a unix timestamp
 *
 * - `YYYY-MM-DD` is a UTC day; `until:` covers the whole day
 * - `12h`, `3d`, `2w`, `1m`, `1y` count back from now (h is exact, the rest are UTC days)
 * - a unix timestamp in seconds
 * - anything else is parsed as natural language ("last week", "yesterday")
 */
export function parseDateValue(
  value: string,
  field: "since" | "until",
  now: Date,
): number | undefined {
  const endOfDay = field === "until" ? DAY - 1 : 0;

  const relative = RELATIVE_DATE.exec(value);
  if (relative) {
    const amount = parseInt(relative[1], 10);
    const unit = relative[2].toLowerCase();
    if (unit === "h") return Math.floor(now.getTime() / 1000) - amount * 3600;

    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    if (unit === "d") date.setUTCDate(date.getUTCDate() - amount);
    else if (unit === "w") date.setUTCDate(date.getUTCDate() - amount * 7);
    else if (unit === "m") date.setUTCMonth(date.getUTCMonth() - amount);
    else date.setUTCFullYear(date.getUTCFullYear() - amount);
    return date.getTime() / 1000 + endOfDay;
  }

  const absolute = ABSOLUTE_DATE.exec(value);
  if (absolute) {
    const [year, month, day] = absolute.slice(1).map((n) => parseInt(n, 10));
    const date = new Date(Date.UTC(year, month - 1, day));
    // Reject dates that roll over, like 2026-02-31
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return undefined;
    }
    return date.getTime() / 1000 + endOfDay;
  }

  if (/^\d+$/.test(value)) return parseInt(value, 10);

  const parsed = parseDate(value, now);
  return parsed ? Math.floor(parsed.getTime() / 1000) : undefined;
}

// ---------------------------------------------------------------------------
// Normalized leaves

type LeafField =
  | "text"
  | "ref"
  | "kind"
  | "by"
  | "mentions"
  | "e"
  | "hashtag"
  | "tag"
  | "mime"
  | "since"
  | "until"
  | "limit"
  | "profile";

interface Leaf {
  type: "leaf";
  field: LeafField;
  values: string[];
  quoted: boolean;
  start: number;
  end: number;
}

interface Group {
  type: "and" | "or";
  children: PlanNode[];
}

type PlanNode = Leaf | Group;

/** Fields whose OR'd values can share a single filter */
const MERGEABLE: LeafField[] = [
  "kind",
  "by",
  "mentions",
  "e",
  "hashtag",
  "mime",
];

const FIELD_ALIASES: Record<
  string,
  LeafField | "is" | "has" | "view" | "sort"
> = {
  kind: "kind",
  k: "kind",
  is: "is",
  by: "by",
  from: "by",
  author: "by",
  a: "by",
  mentions: "mentions",
  e: "e",
  t: "tag",
  tag: "tag",
  m: "mime",
  has: "has",
  since: "since",
  after: "since",
  until: "until",
  before: "until",
  limit: "limit",
  p: "profile",
  view: "view",
  display: "view",
  v: "view",
  sort: "sort",
  order: "sort",
};

/** `scheme:` prefixes that are part of a link or identifier, not a field */
const SCHEMES = ["nostr", "http", "https", "ws", "wss", "ftp"];

const VIEW_FIELDS = ["view", "display", "v"];
const SORT_FIELDS = ["sort", "order"];

/** Result order: newest first (the default) or oldest first */
export type SortOrder = "new" | "old";

const SORT_VALUES: Record<string, SortOrder> = {
  new: "new",
  newest: "new",
  latest: "new",
  desc: "new",
  old: "old",
  oldest: "old",
  asc: "old",
};

function error(leaf: { start: number; end: number }, message: string): never {
  throw new QueryError(message, leaf.start, leaf.end - leaf.start);
}

function splitList(leaf: QueryLeaf & { type: "field" }): string[] {
  if (leaf.quoted) return [leaf.value];
  const values = leaf.value.split(",").map((v) => v.trim());
  if (values.some((v) => !v)) {
    error(leaf, `${leaf.field}: has an empty value in its list`);
  }
  return values;
}

function parseKinds(leaf: QueryLeaf & { type: "field" }): string[] {
  return splitList(leaf).map((value) => {
    if (!/^\d+$/.test(value) || parseInt(value, 10) > 65535) {
      error(leaf, `"${value}" isn't an event kind (0–65535)`);
    }
    return String(parseInt(value, 10));
  });
}

function aliasKinds(leaf: QueryLeaf & { type: "field" }): string[] {
  const kinds = new Set<string>();
  for (const name of splitList(leaf)) {
    const mapped = EVENT_KIND_MAP[name.toLowerCase()];
    if (mapped === undefined) error(leaf, `Unknown type is:${name}`);
    for (const kind of Array.isArray(mapped) ? mapped : [mapped]) {
      kinds.add(String(kind));
    }
  }
  return [...kinds];
}

function leaf(source: QueryLeaf, field: LeafField, values: string[]): Leaf {
  return {
    type: "leaf",
    field,
    values,
    quoted: source.quoted,
    start: source.start,
    end: source.end,
  };
}

/** Map a syntax leaf to a planner leaf, validating its field and values */
function normalizeLeaf(node: QueryLeaf): Leaf {
  if (node.type === "term") {
    if (!node.quoted && node.text.startsWith("#") && node.text.length > 1) {
      return leaf(node, "hashtag", [node.text.slice(1).toLowerCase()]);
    }
    if (!node.quoted && decodeReference(node.text)) {
      return leaf(node, "ref", [node.text]);
    }
    return leaf(node, "text", [node.text]);
  }

  if (SCHEMES.includes(node.field)) {
    const text = `${node.field}:${node.value}`;
    if (decodeReference(text)) return leaf(node, "ref", [text]);
    if (node.field === "nostr") error(node, "Invalid nostr: identifier");
    return leaf(node, "text", [text]);
  }

  const field = FIELD_ALIASES[node.field];
  switch (field) {
    case undefined:
      return error(node, `Unknown field ${node.field}:`);
    case "kind":
      return leaf(node, "kind", parseKinds(node));
    case "is":
      return leaf(node, "kind", aliasKinds(node));
    case "by":
    case "mentions":
      return leaf(node, field, splitList(node));
    case "e":
      return leaf(
        node,
        "e",
        splitList(node).map((value) => {
          const id = decodeEventId(value);
          if (!id) error(node, `"${value}" isn't an event id`);
          return id;
        }),
      );
    case "tag": {
      const eq = node.value.indexOf("=");
      if (eq <= 0 || eq === node.value.length - 1) {
        error(node, "Use tag:name=value");
      }
      return leaf(node, "tag", [node.value]);
    }
    case "mime":
    case "has": {
      const mimes = splitList(node).flatMap((value) => {
        const input = field === "has" ? HAS_MIME[value.toLowerCase()] : value;
        if (!input)
          error(node, `Unknown has:${value} (try image, video, audio)`);
        const expanded = expandMimeType(input);
        if (expanded.length === 0) error(node, `Unknown file type "${value}"`);
        return expanded;
      });
      return leaf(node, "mime", [...new Set(mimes)]);
    }
    case "limit":
      if (!/^\d+$/.test(node.value) || parseInt(node.value, 10) <= 0) {
        error(node, "limit: needs a positive number");
      }
      return leaf(node, "limit", [node.value]);
    case "view":
    case "sort":
      // Removed before planning; reaching here means it's inside a scoped group
      return error(node, `${node.field}: can't be used inside a group`);
    default:
      return leaf(node, field, [node.value]);
  }
}

interface Options {
  view?: string;
  sort?: SortOrder;
}

/**
 * Strip view: and sort: leaves, returning the remaining tree and their last
 * values. They change how results are shown or ordered, not what matches.
 */
function extractOptions(node: QueryNode): Options & { node?: QueryNode } {
  if (node.type === "field" && VIEW_FIELDS.includes(node.field)) {
    return { view: node.value.toLowerCase() };
  }
  if (node.type === "field" && SORT_FIELDS.includes(node.field)) {
    const sort = SORT_VALUES[node.value.toLowerCase()];
    if (!sort) error(node, `Unknown sort:${node.value} (use new or old)`);
    return { sort };
  }
  if (node.type === "term" || node.type === "field") return { node };

  const options: Options = {};
  const children: QueryNode[] = [];
  for (const child of node.children) {
    const { node: rest, view, sort } = extractOptions(child);
    if (view) options.view = view;
    if (sort) options.sort = sort;
    if (rest) children.push(rest);
  }
  if (children.length === 0) return options;
  if (children.length === 1) return { ...options, node: children[0] };
  return { ...options, node: { type: node.type, children } };
}

function normalize(node: QueryNode): PlanNode {
  if ("children" in node) {
    return { type: node.type, children: node.children.map(normalize) };
  }
  return normalizeLeaf(node);
}

// ---------------------------------------------------------------------------
// Expansion into OR branches (disjunctive normal form)

function leafKey(l: Leaf): string {
  return `${l.field}:${l.quoted ? "q" : ""}:${l.values.join(",")}`;
}

function tooManyBranches(): never {
  throw new QueryError(
    `This query expands into more than ${MAX_BRANCHES} searches; use fewer ORs`,
  );
}

/** Merge OR'd leaves of the same mergeable field into one leaf */
function mergeOr(children: PlanNode[]): PlanNode[] {
  const merged: PlanNode[] = [];
  const byField = new Map<LeafField, Leaf>();
  for (const child of children) {
    if (child.type === "leaf" && MERGEABLE.includes(child.field)) {
      const existing = byField.get(child.field);
      if (existing) {
        existing.values = [...new Set([...existing.values, ...child.values])];
        existing.end = Math.max(existing.end, child.end);
        continue;
      }
      const copy = { ...child, values: [...child.values] };
      byField.set(child.field, copy);
      merged.push(copy);
    } else {
      merged.push(child);
    }
  }
  return merged;
}

function expand(node: PlanNode): Leaf[][] {
  if (node.type === "leaf") return [[node]];

  if (node.type === "or") {
    const branches = mergeOr(node.children).flatMap(expand);
    if (branches.length > MAX_BRANCHES) tooManyBranches();
    return branches;
  }

  let branches: Leaf[][] = [[]];
  for (const child of node.children) {
    const options = expand(child);
    if (branches.length * options.length > MAX_BRANCHES) tooManyBranches();
    branches = branches.flatMap((branch) =>
      options.map((option) => [...branch, ...option]),
    );
  }
  return branches;
}

function dedupeBranches(branches: Leaf[][]): Leaf[][] {
  const seen = new Set<string>();
  return branches.filter((branch) => {
    const key = branch.map(leafKey).sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Identifiers

const HEX64 = /^[0-9a-f]{64}$/i;
const NIP19_IN_TEXT = /(note|nevent|naddr|npub|nprofile)1[02-9ac-hj-np-z]{6,}/i;

type Reference =
  | { type: "event"; id: string }
  | { type: "address"; kind: number; pubkey: string; identifier: string }
  | { type: "pubkey"; pubkey: string };

/** Decode a NIP-19 identifier, hex event id, or a link containing one */
export function decodeReference(text: string): Reference | undefined {
  if (HEX64.test(text)) return { type: "event", id: text.toLowerCase() };

  const bare = text.replace(/^nostr:/i, "");
  const isLink = /^[a-z]+:\/\//i.test(text);
  let candidate: string | undefined;

  if (isLink) {
    let decoded = text;
    try {
      decoded = decodeURIComponent(text);
    } catch {
      // Keep the raw link
    }
    candidate = NIP19_IN_TEXT.exec(decoded)?.[0];
  } else if (/^(note|nevent|naddr|npub|nprofile)1/i.test(bare)) {
    candidate = bare;
  }
  if (!candidate) return undefined;

  try {
    const decoded = nip19.decode(candidate.toLowerCase());
    switch (decoded.type) {
      case "note":
        return { type: "event", id: decoded.data };
      case "nevent":
        return { type: "event", id: decoded.data.id };
      case "naddr":
        return {
          type: "address",
          kind: decoded.data.kind,
          pubkey: decoded.data.pubkey,
          identifier: decoded.data.identifier,
        };
      case "npub":
        return { type: "pubkey", pubkey: decoded.data };
      case "nprofile":
        return { type: "pubkey", pubkey: decoded.data.pubkey };
    }
  } catch {
    // Not a valid identifier
  }
  return undefined;
}

function decodeEventId(value: string): string | undefined {
  const ref = decodeReference(value);
  return ref?.type === "event" ? ref.id : undefined;
}

/** A hex pubkey for npub/nprofile/hex input, or undefined for a name */
export function decodePubkey(value: string): string | undefined {
  if (HEX64.test(value)) return value.toLowerCase();
  const ref = decodeReference(value);
  return ref?.type === "pubkey" ? ref.pubkey : undefined;
}

// ---------------------------------------------------------------------------
// Compiling a branch to a filter

/** A by:/mentions: clause that still contains names to look up */
export interface PubkeyClause {
  target: "authors" | "#p";
  /** Hex pubkeys or names */
  values: string[];
}

export interface QueryBranch {
  filter: Filter;
  /** Clauses that must be resolved and intersected into the filter */
  pending: PubkeyClause[];
}

export interface QueryPlan {
  branches: QueryBranch[];
  /** p: profile lookup terms; when set the query is a profile lookup */
  profileLookup: string[];
  /** view: display mode, never part of the filter */
  view?: string;
  /** sort: order, never part of the filter; newest first when unset */
  sort?: SortOrder;
  /** Kinds every branch is limited to, or empty when any kind can match */
  kinds: number[];
  /** MIME types every branch is limited to, or empty */
  mimeTypes: string[];
  /** True when a branch needs NIP-50 full text search */
  needsSearch: boolean;
  /** The largest limit: the user typed, if any */
  limit?: number;
}

export interface PlanOptions {
  now?: Date;
  /** Kinds used when a branch doesn't limit kinds */
  defaultKinds?: number[];
  limit?: number;
}

function intersect(sets: string[][]): string[] {
  const [first, ...rest] = sets;
  return first.filter((value) => rest.every((set) => set.includes(value)));
}

const CONFLICT_HINTS: Record<string, string> = {
  kinds: "No event has all of these kinds; use OR to match any of them",
  ids: "These point to different events; use OR to match any of them",
  authors: "These are different authors; use OR to match any of them",
  "#t": "Events can't be matched on two different hashtags at once; use #a OR #b",
  "#m": "These file types don't overlap; use OR to match any of them",
};

class BranchBuilder {
  private search: string[] = [];
  private sets = new Map<string, { values: string[][]; leaf: Leaf }>();
  private pubkeyClauses: (PubkeyClause & { leaf: Leaf })[] = [];
  private since?: { value: number; leaf: Leaf };
  private until?: { value: number; leaf: Leaf };
  private limit?: number;
  private readonly options: PlanOptions;
  private readonly now: Date;

  constructor(options: PlanOptions) {
    this.options = options;
    this.now = options.now ?? new Date();
  }

  private addSet(key: string, values: string[], source: Leaf) {
    const entry = this.sets.get(key);
    if (entry) entry.values.push(values);
    else this.sets.set(key, { values: [values], leaf: source });
    if (entry) entry.leaf = source;
  }

  add(l: Leaf) {
    switch (l.field) {
      case "text":
        this.search.push(l.quoted ? JSON.stringify(l.values[0]) : l.values[0]);
        break;
      case "ref": {
        const ref = decodeReference(l.values[0])!;
        if (ref.type === "event") this.addSet("ids", [ref.id], l);
        else if (ref.type === "pubkey") {
          this.pubkeyClauses.push({
            target: "authors",
            values: [ref.pubkey],
            leaf: l,
          });
        } else {
          this.addSet("kinds", [String(ref.kind)], l);
          this.addSet("#d", [ref.identifier], l);
          this.pubkeyClauses.push({
            target: "authors",
            values: [ref.pubkey],
            leaf: l,
          });
        }
        break;
      }
      case "kind":
        this.addSet("kinds", l.values, l);
        break;
      case "by":
        this.pubkeyClauses.push({
          target: "authors",
          values: l.values,
          leaf: l,
        });
        break;
      case "mentions":
        this.pubkeyClauses.push({ target: "#p", values: l.values, leaf: l });
        break;
      case "e":
        this.addSet("#e", l.values, l);
        break;
      case "hashtag":
        this.addSet("#t", l.values, l);
        break;
      case "tag": {
        const [name, ...rest] = l.values[0].split("=");
        this.addSet(`#${name}`, [rest.join("=")], l);
        break;
      }
      case "mime":
        this.addSet("#m", l.values, l);
        break;
      case "since":
      case "until": {
        const value = parseDateValue(l.values[0], l.field, this.now);
        if (value === undefined) {
          error(
            l,
            `Couldn't read the date "${l.values[0]}"; use ${l.field}:YYYY-MM-DD or ${l.field}:2w (h, d, w, m, y)`,
          );
        }
        if (l.field === "since") {
          if (!this.since || value > this.since.value)
            this.since = { value, leaf: l };
        } else if (!this.until || value < this.until.value) {
          this.until = { value, leaf: l };
        }
        break;
      }
      case "limit":
        this.limit = parseInt(l.values[0], 10);
        break;
      case "profile":
        error(
          l,
          "p: profile lookups can't be combined with other search terms",
        );
    }
  }

  build(): QueryBranch {
    const filter: Filter = {};

    for (const [key, { values, leaf: source }] of this.sets) {
      const merged = intersect(values);
      if (merged.length === 0) {
        error(
          source,
          CONFLICT_HINTS[key] ??
            `Conflicting ${key} values; use OR to match any of them`,
        );
      }
      if (key === "kinds") filter.kinds = merged.map((k) => parseInt(k, 10));
      else if (key === "ids") filter.ids = merged;
      else filter[key as `#${string}`] = merged;
    }

    if (!filter.kinds && this.options.defaultKinds?.length) {
      filter.kinds = [...this.options.defaultKinds];
    }

    const pending: PubkeyClause[] = [];
    for (const target of ["authors", "#p"] as const) {
      const clauses = this.pubkeyClauses.filter((c) => c.target === target);
      if (clauses.length === 0) continue;
      if (target === "#p" && clauses.length > 1) {
        error(
          clauses[1].leaf,
          "Only one mentions: is allowed; use mentions:a,b to match any of them",
        );
      }

      const decoded = clauses.map((c) =>
        c.values.map((v) => decodePubkey(v) ?? v),
      );
      if (clauses.every((c) => c.values.every((v) => decodePubkey(v)))) {
        const merged = intersect(decoded);
        if (merged.length === 0) {
          error(clauses[clauses.length - 1].leaf, CONFLICT_HINTS.authors);
        }
        filter[target] = merged;
      } else {
        for (const values of decoded) pending.push({ target, values });
      }
    }

    if (this.since && this.until && this.since.value > this.until.value) {
      error(this.until.leaf, "until: is before since:");
    }
    if (this.since) filter.since = this.since.value;
    if (this.until) filter.until = this.until.value;

    const search = this.search.join(" ");
    if (search) filter.search = search;

    filter.limit = this.limit ?? this.options.limit ?? DEFAULT_LIMIT;

    return { filter, pending };
  }
}

/** Values every branch is limited to, or empty when a branch is unrestricted */
function sharedValues(lists: (string[] | number[] | undefined)[]): string[] {
  if (lists.length === 0 || lists.some((list) => !list?.length)) return [];
  return [...new Set(lists.flatMap((list) => list!.map(String)))];
}

/**
 * Parse and plan a query into one filter per OR branch. Throws `QueryError`.
 * Names in by:/mentions: are left in `pending`; call `resolvePlan` for filters.
 */
export function planQuery(query: string, options: PlanOptions = {}): QueryPlan {
  const tree = parseQueryTree(query);
  const { node, view, sort } = extractOptions(tree);

  const plan: QueryPlan = {
    branches: [],
    profileLookup: [],
    view,
    sort,
    kinds: [],
    mimeTypes: [],
    needsSearch: false,
  };
  if (!node) return plan;

  const branches = dedupeBranches(expand(normalize(node)));

  // A p: lookup can only be combined with other p: terms
  const leaves = branches.flat();
  const profiles = leaves.filter((l) => l.field === "profile");
  if (profiles.length > 0) {
    const other = leaves.find((l) => l.field !== "profile");
    if (other)
      error(
        other,
        "p: profile lookups can't be combined with other search terms",
      );
    plan.profileLookup = [...new Set(profiles.map((l) => l.values[0]))];
    return plan;
  }

  plan.branches = branches.map((branch) => {
    const builder = new BranchBuilder(options);
    for (const l of branch) builder.add(l);
    return builder.build();
  });

  // Identical filters can come from different spellings, e.g. kind:20 OR is:image
  const seen = new Set<string>();
  plan.branches = plan.branches.filter((b) => {
    const key = JSON.stringify(b);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const filters = plan.branches.map((b) => b.filter);
  plan.kinds = sharedValues(filters.map((f) => f.kinds)).map((k) =>
    parseInt(k, 10),
  );
  plan.mimeTypes = sharedValues(filters.map((f) => f["#m"]));
  plan.needsSearch = filters.some((f) => !!f.search);

  const limits = leaves
    .filter((l) => l.field === "limit")
    .map((l) => parseInt(l.values[0], 10));
  if (limits.length > 0) plan.limit = Math.max(...limits);

  return plan;
}

/** Plan a query without throwing; invalid queries plan to nothing */
export function tryPlanQuery(
  query: string,
  options?: PlanOptions,
): QueryPlan | undefined {
  try {
    return planQuery(query, options);
  } catch {
    return undefined;
  }
}

/** Every by:/mentions: name in a plan that needs a lookup */
export function pendingNames(plan: QueryPlan): string[] {
  const names = plan.branches.flatMap((b) =>
    b.pending.flatMap((c) => c.values.filter((v) => !decodePubkey(v))),
  );
  return [...new Set(names)];
}

/**
 * Resolve the names left in a plan's branches into pubkeys and return the final filters.
 * `lookup` returns the best matching pubkey for a name, or undefined.
 */
export async function resolvePlan(
  plan: QueryPlan,
  lookup: (name: string) => Promise<string | undefined>,
): Promise<Filter[]> {
  const names = pendingNames(plan);
  const resolved = new Map<string, string>();

  await Promise.all(
    names.map(async (name) => {
      const pubkey = await lookup(name);
      if (!pubkey)
        throw new QueryError(`Couldn't find a profile for "${name}"`);
      resolved.set(name, pubkey);
    }),
  );

  return plan.branches.map(({ filter, pending }) => {
    const result: Filter = { ...filter };
    for (const target of ["authors", "#p"] as const) {
      const clauses = pending
        .filter((c) => c.target === target)
        .map((c) => [
          ...new Set(c.values.map((v) => decodePubkey(v) ?? resolved.get(v)!)),
        ]);
      if (clauses.length === 0) continue;
      const merged = intersect(clauses);
      if (merged.length === 0) throw new QueryError(CONFLICT_HINTS.authors);
      result[target] = merged;
    }
    return result;
  });
}
