import type { NostrEvent } from "nostr-tools";
import {
  getCommentReplyPointer,
  getCommentRootPointer,
  getNip10References,
} from "applesauce-common/helpers";

/** What a group of results is a conversation about */
export type ThreadRoot =
  | { type: "event"; id: string }
  | { type: "address"; kind: number; pubkey: string; identifier: string }
  /** A NIP-73 external id or URL, from a comment's `I` tag */
  | { type: "external"; value: string }
  /** A NIP-29 group (`h` tag), or chat with no group */
  | { type: "group"; id?: string }
  /** A set of people messaging each other (NIP-A4 public messages) */
  | { type: "people"; pubkeys: string[] };

export interface ThreadInfo {
  /** Results with the same key are in the same conversation */
  key: string;
  root: ThreadRoot;
  /** The id of the event this one replies to, if known */
  parent?: string;
  /** Render as chat in time order rather than a reply tree */
  chat: boolean;
}

/** Kinds that read as chat messages rather than threaded replies */
const CHAT_KINDS = [9, 42, 1311, 24];

function rootKey(root: ThreadRoot): string {
  switch (root.type) {
    case "event":
      return `e:${root.id}`;
    case "address":
      return `a:${root.kind}:${root.pubkey}:${root.identifier}`;
    case "external":
      return `i:${root.value}`;
    case "group":
      return `h:${root.id ?? ""}`;
    case "people":
      return `p:${root.pubkeys.join(",")}`;
  }
}

function tagValue(event: NostrEvent, name: string) {
  return event.tags.find((t) => t[0] === name && t[1])?.[1];
}

function parseCoordinate(value?: string): ThreadRoot | undefined {
  const [kind, pubkey, ...identifier] = value?.split(":") ?? [];
  if (!kind || !pubkey || Number.isNaN(Number(kind))) return undefined;
  return {
    type: "address",
    kind: Number(kind),
    pubkey,
    identifier: identifier.join(":"),
  };
}

function build(event: NostrEvent): Omit<ThreadInfo, "key"> {
  const chat = CHAT_KINDS.includes(event.kind);

  switch (event.kind) {
    // NIP-22 comments carry their root and parent explicitly
    case 1111: {
      const root = getCommentRootPointer(event);
      const reply = getCommentReplyPointer(event);
      const parent = reply?.type === "event" ? reply.id : undefined;
      if (root?.type === "event")
        return { root: { type: "event", id: root.id }, parent, chat };
      if (root?.type === "address")
        return {
          root: {
            type: "address",
            kind: root.kind,
            pubkey: root.pubkey,
            identifier: root.identifier,
          },
          parent,
          chat,
        };
      const external = tagValue(event, "I");
      if (external)
        return { root: { type: "external", value: external }, parent, chat };
      break;
    }
    // NIP-C7 / NIP-29 chat messages, grouped by the group they were sent to
    case 9:
      return { root: { type: "group", id: tagValue(event, "h") }, chat };
    // NIP-53 live chat belongs to the live event in its `a` tag
    case 1311: {
      const root = parseCoordinate(tagValue(event, "a"));
      if (root) return { root, chat };
      break;
    }
    // NIP-A4 public messages: everyone in the conversation, in a stable order
    case 24: {
      const pubkeys = [
        ...new Set([
          event.pubkey,
          ...event.tags.filter((t) => t[0] === "p" && t[1]).map((t) => t[1]),
        ]),
      ].sort();
      return { root: { type: "people", pubkeys }, chat };
    }
  }

  // NIP-10 threading for notes, channel messages and anything else with `e` tags
  const refs = getNip10References(event);
  const parent = refs.reply?.e?.id ?? refs.root?.e?.id;
  if (refs.root?.e)
    return { root: { type: "event", id: refs.root.e.id }, parent, chat };
  if (refs.root?.a)
    return {
      root: {
        type: "address",
        kind: refs.root.a.kind,
        pubkey: refs.root.a.pubkey,
        identifier: refs.root.a.identifier,
      },
      parent,
      chat,
    };
  if (parent) return { root: { type: "event", id: parent }, parent, chat };

  // Not a reply: the event starts its own conversation
  return { root: { type: "event", id: event.id }, chat };
}

const cache = new WeakMap<NostrEvent, ThreadInfo>();

/** Which conversation an event belongs to, and what it replies to. Cached per event. */
export function getThreadInfo(event: NostrEvent): ThreadInfo {
  let info = cache.get(event);
  if (!info) {
    let built: Omit<ThreadInfo, "key">;
    try {
      built = build(event);
    } catch {
      // Malformed tags: treat the event as its own conversation
      built = {
        root: { type: "event", id: event.id },
        chat: CHAT_KINDS.includes(event.kind),
      };
    }
    info = { ...built, key: rootKey(built.root) };
    cache.set(event, info);
  }
  return info;
}

const roots = new Map<string, Promise<NostrEvent | undefined>>();

/**
 * Looks up the event a conversation is about in the local database only. The
 * search never asked for it, so it is fetched separately and is often missing.
 */
export function loadThreadRoot(
  root: ThreadRoot,
): Promise<NostrEvent | undefined> {
  if (root.type !== "event" && root.type !== "address")
    return Promise.resolve(undefined);
  const key = rootKey(root);
  let request = roots.get(key);
  if (!request) {
    request = (
      root.type === "event"
        ? window.nostrdb.event(root.id)
        : window.nostrdb.replaceable(root.kind, root.pubkey, root.identifier)
    ).catch(() => undefined);
    roots.set(key, request);
  }
  return request;
}
