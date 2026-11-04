/**
 * Client-side filters over results that are already loaded. They never change
 * what is fetched, so toggling them is instant and needs no network.
 */
import type { NostrEvent } from "nostr-tools";
import { getThreadInfo } from "./ThreadService";
import { KIND_NAMES } from "./QueryAssist";

export interface ResultFilterSettings {
  /** Master switch, so the rules can be kept while showing everything */
  enabled: boolean;
  hideReplies: boolean;
  hideReposts: boolean;
  /** `content-warning` tags and nsfw hashtags */
  hideNsfw: boolean;
  /** Direct messages and other encrypted payloads */
  hideEncrypted: boolean;
  /** Events bridged from other networks (NIP-48 `proxy` tag) */
  hideBridged: boolean;
  /** Hide posts with more hashtags than this, 0 for no limit */
  maxHashtags: number;
  /** Hide posts mentioning more people than this, 0 for no limit */
  maxMentions: number;
}

export type HideReason =
  | "text"
  | "replies"
  | "reposts"
  | "nsfw"
  | "encrypted"
  | "bridged"
  | "hashtags"
  | "mentions";

export const HIDE_REASON_LABELS: Record<HideReason, string> = {
  text: "don't match the text filter",
  replies: "replies",
  reposts: "reposts",
  nsfw: "marked sensitive",
  encrypted: "encrypted",
  bridged: "bridged",
  hashtags: "too many hashtags",
  mentions: "too many mentions",
};

export const DEFAULT_FILTER_SETTINGS: ResultFilterSettings = {
  enabled: true,
  hideReplies: false,
  hideReposts: false,
  hideNsfw: false,
  hideEncrypted: false,
  hideBridged: false,
  maxHashtags: 0,
  maxMentions: 0,
};

interface EventFacts {
  reply: boolean;
  repost: boolean;
  nsfw: boolean;
  encrypted: boolean;
  bridged: boolean;
  hashtags: number;
  mentions: number;
  /** Lowercased content and title-like tags, for the text filter */
  text: string;
}

const NSFW_TAGS = new Set(["nsfw", "porn", "xxx", "nude", "nudity", "sex"]);
const ENCRYPTED_KINDS = new Set([4, 13, 14, 15, 44, 1059, 1060, 24133]);
/** NIP-04 ciphertext ends with an initialisation vector */
const NIP04 = /\?iv=[A-Za-z0-9+/=]{16,}$/;
/** Kinds whose `t` / `p` tags are a list, not a post's hashtags and mentions */
const isList = (kind: number) =>
  kind === 3 ||
  (kind >= 10000 && kind < 20000) ||
  (kind >= 30000 && kind < 40000 && kind !== 30023);
const TEXT_TAGS = new Set(["title", "summary", "subject", "alt", "name"]);

const facts = new WeakMap<NostrEvent, EventFacts>();

function analyze(event: NostrEvent): EventFacts {
  let result = facts.get(event);
  if (result) return result;

  let hashtags = 0;
  let mentions = 0;
  let nsfw = false;
  let bridged = false;
  const text = [event.content];
  for (const tag of event.tags) {
    switch (tag[0]) {
      case "t":
        hashtags++;
        if (NSFW_TAGS.has(tag[1]?.toLowerCase())) nsfw = true;
        break;
      case "p":
        mentions++;
        break;
      case "content-warning":
        nsfw = true;
        break;
      case "L":
      case "l":
        if (tag[1]?.toLowerCase() === "content-warning") nsfw = true;
        break;
      case "proxy":
        bridged = true;
        break;
      default:
        if (TEXT_TAGS.has(tag[0]) && tag[1]) text.push(tag[1]);
    }
  }

  let reply = event.kind === 1111;
  if (event.kind === 1) {
    try {
      reply = getThreadInfo(event).parent !== undefined;
    } catch {
      reply = false;
    }
  }

  const list = isList(event.kind);
  result = {
    reply,
    repost: event.kind === 6 || event.kind === 16,
    nsfw,
    encrypted: ENCRYPTED_KINDS.has(event.kind) || NIP04.test(event.content),
    bridged,
    hashtags: list ? 0 : hashtags,
    mentions: list ? 0 : mentions,
    text: text.join("\n").toLowerCase(),
  };
  facts.set(event, result);
  return result;
}

/** Why an event is hidden, or undefined when it is shown */
export function hideReason(
  event: NostrEvent,
  settings: ResultFilterSettings,
  words: string[] = [],
): HideReason | undefined {
  const f = analyze(event);
  if (words.length && !words.every((w) => f.text.includes(w))) return "text";
  if (!settings.enabled) return undefined;
  if (settings.hideReplies && f.reply) return "replies";
  if (settings.hideReposts && f.repost) return "reposts";
  if (settings.hideNsfw && f.nsfw) return "nsfw";
  if (settings.hideEncrypted && f.encrypted) return "encrypted";
  if (settings.hideBridged && f.bridged) return "bridged";
  if (settings.maxHashtags > 0 && f.hashtags > settings.maxHashtags)
    return "hashtags";
  if (settings.maxMentions > 0 && f.mentions > settings.maxMentions)
    return "mentions";
  return undefined;
}

export interface FilterResult {
  visible: NostrEvent[];
  hidden: number;
  reasons: Partial<Record<HideReason, number>>;
}

/** Split a text filter into lowercased words, keeping "quoted phrases" whole */
export function filterWords(text: string): string[] {
  return [...text.toLowerCase().matchAll(/"([^"]+)"|(\S+)/g)].map(
    (m) => m[1] ?? m[2],
  );
}

export function applyResultFilters(
  events: NostrEvent[],
  settings: ResultFilterSettings,
  text = "",
): FilterResult {
  const words = filterWords(text);
  const reasons: Partial<Record<HideReason, number>> = {};
  const visible: NostrEvent[] = [];
  for (const event of events) {
    const reason = hideReason(event, settings, words);
    if (reason) reasons[reason] = (reasons[reason] ?? 0) + 1;
    else visible.push(event);
  }
  return { visible, hidden: events.length - visible.length, reasons };
}

/** True when any rule could hide something */
export function hasActiveRules(settings: ResultFilterSettings): boolean {
  return (
    settings.enabled &&
    (settings.hideReplies ||
      settings.hideReposts ||
      settings.hideNsfw ||
      settings.hideEncrypted ||
      settings.hideBridged ||
      settings.maxHashtags > 0 ||
      settings.maxMentions > 0)
  );
}

export interface KindFacet {
  kind: number;
  label: string;
  count: number;
}

/** The most common kinds among loaded results */
export function kindFacets(events: NostrEvent[], max = 8): KindFacet[] {
  const counts = new Map<number, number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, max)
    .map(([kind, count]) => ({
      kind,
      count,
      label: KIND_NAMES[kind] ?? `kind ${kind}`,
    }));
}

// ---------------------------------------------------------------------------
// Persistence

const STORAGE_KEY = "backyard-explorer:result-filters";

export function loadFilterSettings(): ResultFilterSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { ...DEFAULT_FILTER_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_FILTER_SETTINGS };
  }
}

export function saveFilterSettings(settings: ResultFilterSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or disabled; filters still apply for this session
  }
}
