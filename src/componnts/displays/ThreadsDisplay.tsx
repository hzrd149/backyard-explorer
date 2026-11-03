import type { NostrEvent } from "nostr-tools";
import {
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import {
  getThreadInfo,
  loadThreadRoot,
  type ThreadRoot,
} from "../../services/ThreadService";
import EventCard from "../events/EventCard";
import RichContent from "../RichContent";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import { eventLink, formatDateTime, tagValue } from "./format";
import type { DisplayProps } from "./types";

/** Replies shown per conversation before "show more" */
const PREVIEW = 6;
/** Deeper replies are shown at this depth, so narrow screens keep room for text */
const MAX_DEPTH = 4;

interface Conversation {
  root: ThreadRoot;
  chat: boolean;
  /** The results in this conversation, newest first */
  events: NostrEvent[];
}

/**
 * Groups the results into the conversations they belong to: notes and comments
 * as reply trees under the event they discuss, chat messages in time order.
 */
export default function ThreadsDisplay(props: DisplayProps) {
  const conversations = createMemo(() => {
    const byKey = new Map<string, Conversation>();
    for (const event of props.events) {
      const info = getThreadInfo(event);
      let conversation = byKey.get(info.key);
      if (!conversation) {
        conversation = { root: info.root, chat: info.chat, events: [] };
        byKey.set(info.key, conversation);
      }
      conversation.events.push(event);
    }
    return byKey;
  });
  // Iterate the keys, strings keep their identity when more results load
  const keys = createMemo(() => [...conversations().keys()]);

  return (
    <div class="space-y-4">
      <For each={keys()}>
        {(key) => (
          <div class="[content-visibility:auto] [contain-intrinsic-size:auto_400px]">
            <ConversationCard conversation={conversations().get(key)!} />
          </div>
        )}
      </For>
      <Show when={props.complete && props.events.length === 0}>
        <p class="text-center text-base-content/50 mt-8">
          No conversations found in these results.
        </p>
      </Show>
    </div>
  );
}

function ConversationCard(props: { conversation: Conversation }) {
  const root = () => props.conversation.root;
  // The root may be one of the results, otherwise look for it in the local database
  const loadedRoot = () => {
    const r = root();
    return r.type === "event"
      ? props.conversation.events.find((e) => e.id === r.id)
      : undefined;
  };
  const [storedRoot] = createResource(
    () => (loadedRoot() ? undefined : root()),
    loadThreadRoot,
  );
  const rootEvent = () => loadedRoot() ?? storedRoot();
  const replies = () =>
    props.conversation.events.filter((e) => e !== loadedRoot());

  return (
    <section class="card border border-base-300 bg-base-100 shadow-sm">
      <div class="card-body gap-3 p-4">
        <Show
          when={rootEvent()}
          fallback={
            <RootPlaceholder root={root()} loading={storedRoot.loading} />
          }
        >
          {(event) => (
            <div classList={{ "opacity-80": event() !== loadedRoot() }}>
              <Show when={event() !== loadedRoot()}>
                <div class="mb-1 text-xs text-base-content/50">
                  Replying to (not in results)
                </div>
              </Show>
              <EventCard event={event()} />
            </div>
          )}
        </Show>

        <Show when={replies().length > 0}>
          <Show
            when={props.conversation.chat}
            fallback={
              <ReplyTree replies={replies()} rootId={rootEvent()?.id} />
            }
          >
            <ChatLog messages={replies()} />
          </Show>
        </Show>
      </div>
    </section>
  );
}

function RootPlaceholder(props: { root: ThreadRoot; loading: boolean }) {
  return (
    <div class="rounded-box border border-dashed border-base-300 px-3 py-2 text-sm text-base-content/60">
      <Switch>
        <Match when={props.loading}>
          <span class="loading loading-dots loading-xs" />
        </Match>
        <Match when={props.root.type === "external" && props.root}>
          {(root) => (
            <span>
              Comments on{" "}
              <Show
                when={/^https?:\/\//.test(root().value)}
                fallback={<code class="break-all">{root().value}</code>}
              >
                <a
                  href={root().value}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link link-primary break-all"
                >
                  {root().value}
                </a>
              </Show>
            </span>
          )}
        </Match>
        <Match when={props.root.type === "group" && props.root}>
          {(root) => (
            <span>
              💬{" "}
              {root().id ? (
                <>
                  Group chat <code>{root().id}</code>
                </>
              ) : (
                "Chat messages"
              )}
            </span>
          )}
        </Match>
        <Match when={props.root.type === "people" && props.root}>
          {(root) => (
            <span class="flex flex-wrap items-center gap-2">
              Conversation between
              <For each={root().pubkeys}>
                {(pubkey) => (
                  <span class="flex items-center gap-1">
                    <UserAvatar pubkey={pubkey} size="xs" />
                    <UserName pubkey={pubkey} maxLength={16} />
                  </span>
                )}
              </For>
            </span>
          )}
        </Match>
        <Match when={true}>
          The start of this thread isn't in the local database
        </Match>
      </Switch>
    </div>
  );
}

/** Replies nested under what they reply to, oldest first like a conversation */
function ReplyTree(props: { replies: NostrEvent[]; rootId?: string }) {
  const [expanded, setExpanded] = createSignal(false);

  const tree = createMemo(() => {
    const ids = new Set(props.replies.map((e) => e.id));
    const children = new Map<string, NostrEvent[]>();
    const top: NostrEvent[] = [];
    // Oldest first, the results arrive newest first
    for (const event of [...props.replies].reverse()) {
      const parent = getThreadInfo(event).parent;
      if (parent && parent !== props.rootId && ids.has(parent)) {
        const list = children.get(parent) ?? [];
        list.push(event);
        children.set(parent, list);
      } else top.push(event);
    }
    return { top, children };
  });

  const shown = () => (expanded() ? tree().top : tree().top.slice(0, PREVIEW));

  const Branch = (branch: { event: NostrEvent; depth: number }) => (
    <li>
      <Message event={branch.event} />
      <Show when={tree().children.get(branch.event.id)}>
        {(kids) => (
          <ul
            class="mt-2 space-y-2 border-l-2 border-base-300"
            classList={{ "ml-4 pl-3": branch.depth < MAX_DEPTH }}
          >
            <For each={kids()}>
              {(kid) => <Branch event={kid} depth={branch.depth + 1} />}
            </For>
          </ul>
        )}
      </Show>
    </li>
  );

  return (
    <div>
      <ul class="space-y-3 border-l-2 border-primary/30 pl-3">
        <For each={shown()}>
          {(event) => <Branch event={event} depth={1} />}
        </For>
      </ul>
      <Show when={tree().top.length > PREVIEW && !expanded()}>
        <button
          class="btn btn-ghost btn-xs mt-2"
          onClick={() => setExpanded(true)}
        >
          Show {tree().top.length - PREVIEW} more replies
        </button>
      </Show>
    </div>
  );
}

/** Chat messages in time order, the latest shown first are the last few */
function ChatLog(props: { messages: NostrEvent[] }) {
  const [expanded, setExpanded] = createSignal(false);
  const ordered = createMemo(() => [...props.messages].reverse());
  const shown = () => (expanded() ? ordered() : ordered().slice(-PREVIEW * 2));

  return (
    <div class="rounded-box bg-base-200/60 p-3">
      <Show when={ordered().length > shown().length}>
        <button
          class="btn btn-ghost btn-xs mb-2"
          onClick={() => setExpanded(true)}
        >
          Show {ordered().length - shown().length} earlier messages
        </button>
      </Show>
      <ul class="space-y-2">
        <For each={shown()}>
          {(event) => (
            <li class="flex items-start gap-2">
              <UserAvatar pubkey={event.pubkey} size="sm" />
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-2 text-xs">
                  <UserName
                    pubkey={event.pubkey}
                    maxLength={20}
                    class="font-semibold"
                  />
                  <a
                    href={eventLink(event)}
                    class="text-base-content/50 hover:underline"
                    title={new Date(event.created_at * 1000).toLocaleString()}
                  >
                    {formatDateTime(event.created_at)}
                  </a>
                </div>
                <div class="mt-0.5 inline-block max-w-full rounded-2xl rounded-tl-sm bg-base-100 px-3 py-1.5 text-sm break-words">
                  <RichContent content={event.content} pubkey={event.pubkey} />
                </div>
              </div>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

function Message(props: { event: NostrEvent }) {
  const subject = () =>
    tagValue(props.event, "title") ?? tagValue(props.event, "subject");
  return (
    <article class="flex items-start gap-2">
      <UserAvatar pubkey={props.event.pubkey} size="sm" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline gap-x-2 text-xs">
          <UserName
            pubkey={props.event.pubkey}
            maxLength={20}
            class="font-semibold"
          />
          <a
            href={eventLink(props.event)}
            class="text-base-content/50 hover:underline"
          >
            {formatDateTime(props.event.created_at)}
          </a>
          <Show when={props.event.kind !== 1}>
            <span class="badge badge-ghost badge-xs">
              kind {props.event.kind}
            </span>
          </Show>
        </div>
        <Show when={subject()}>
          <div class="font-semibold">{subject()}</div>
        </Show>
        <div class="text-sm break-words">
          <RichContent
            content={props.event.content}
            pubkey={props.event.pubkey}
          />
        </div>
      </div>
    </article>
  );
}
