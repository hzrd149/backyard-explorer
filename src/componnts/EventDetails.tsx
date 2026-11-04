import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { NostrEvent } from "nostr-tools";
import { nip19 } from "nostr-tools";
import { getThreadInfo, loadThreadRoot } from "../services/ThreadService";
import { getEventBlobHashes, type BlobRef } from "../services/BlobHashes";
import { getBlossomProxyUrl } from "../services/ConfigService";
import { deepLink } from "../services/DeepLinks";
import { KIND_NAMES } from "../services/QueryAssist";
import { useSearch } from "../context/SearchContext";
import CopyButton from "./displays/CopyButton";
import UserAvatar from "./UserAvatar";
import UserName from "./UserName";

const [current, setCurrent] = createSignal<NostrEvent | null>(null);

/** Show the details panel for an event */
export function openEventDetails(event: NostrEvent) {
  setCurrent(event);
}

export function closeEventDetails() {
  setCurrent(null);
}

/** How far up a reply chain to walk */
const MAX_ANCESTORS = 12;

const isAddressable = (kind: number) => kind >= 30000 && kind < 40000;

/** The NIP-19 pointer for an event: naddr for addressable kinds, nevent otherwise */
export function eventPointer(event: NostrEvent): {
  route: "a" | "e";
  value: string;
} {
  if (isAddressable(event.kind)) {
    const identifier = event.tags.find((t) => t[0] === "d")?.[1] ?? "";
    return {
      route: "a",
      value: nip19.naddrEncode({
        kind: event.kind,
        pubkey: event.pubkey,
        identifier,
      }),
    };
  }
  return {
    route: "e",
    value: nip19.neventEncode({
      id: event.id,
      author: event.pubkey,
      kind: event.kind,
    }),
  };
}

/** A query for events tagging an addressable event with its `a` coordinate */
function addressSearch(event: NostrEvent): string {
  const d = event.tags.find((t) => t[0] === "d")?.[1] ?? "";
  const coordinate = `a=${event.kind}:${event.pubkey}:${d}`;
  return `t:"${coordinate.replace(/["\\]/g, "\\$&")}"`;
}

/** The events this one replies to, nearest first, from the local database only */
async function loadAncestors(event: NostrEvent): Promise<NostrEvent[]> {
  const chain: NostrEvent[] = [];
  const seen = new Set([event.id]);
  let next: NostrEvent | undefined = event;

  while (next && chain.length < MAX_ANCESTORS) {
    const info = getThreadInfo(next);
    let parent: NostrEvent | undefined;
    if (info.parent && !seen.has(info.parent)) {
      parent = await window.nostrdb.event(info.parent).catch(() => undefined);
    }
    // Missing parent: jump to the conversation root if it is stored
    if (!parent && next === event) parent = await loadThreadRoot(info.root);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    chain.push(parent);
    next = parent;
  }
  return chain;
}

type BlobStatus = "cached" | "missing" | "error";

/** HEAD the local Blossom cache. Without server hints it can't fetch upstream, so 200 means stored */
async function checkBlob(proxy: string, sha256: string): Promise<BlobStatus> {
  try {
    const response = await fetch(new URL(`/${sha256}`, proxy), {
      method: "HEAD",
      cache: "no-store",
      credentials: "omit",
    });
    if (response.ok) return "cached";
    return response.status === 404 ? "missing" : "error";
  } catch {
    return "error";
  }
}

function BlobRow(props: { blob: BlobRef; proxy?: string }) {
  const [status] = createResource(
    () => props.proxy,
    (proxy) => checkBlob(proxy, props.blob.sha256),
  );
  const badge = () => {
    if (!props.proxy) return ["badge-ghost", "no local cache"];
    switch (status()) {
      case "cached":
        return ["badge-success", "cached"];
      case "missing":
        return ["badge-warning", "not cached"];
      case "error":
        return ["badge-error", "unreachable"];
      default:
        return ["badge-ghost", "checking…"];
    }
  };
  return (
    <li class="flex items-center gap-2 text-xs">
      <span class={`badge badge-sm ${badge()[0]}`}>{badge()[1]}</span>
      <span class="font-mono truncate" title={props.blob.sha256}>
        {props.blob.sha256.slice(0, 16)}…
      </span>
      <Show when={props.blob.mime}>
        <span class="text-base-content/50">{props.blob.mime}</span>
      </Show>
      <Show when={props.proxy && status() === "cached"}>
        <a
          class="link link-primary ml-auto"
          href={new URL(`/${props.blob.sha256}`, props.proxy).toString()}
          target="_blank"
          rel="noopener noreferrer"
        >
          open
        </a>
      </Show>
    </li>
  );
}

function AncestorRow(props: { event: NostrEvent; onOpen: () => void }) {
  return (
    <li>
      <button
        class="w-full text-left flex items-start gap-2 rounded p-2 hover:bg-base-200"
        onClick={props.onOpen}
      >
        <UserAvatar pubkey={props.event.pubkey} size="xs" />
        <div class="min-w-0 flex-1">
          <div class="text-xs text-base-content/60 flex gap-2">
            <UserName pubkey={props.event.pubkey} maxLength={20} />
            <span>
              {new Date(props.event.created_at * 1000).toLocaleString()}
            </span>
          </div>
          <div class="text-sm line-clamp-2 break-words">
            {props.event.content || `kind ${props.event.kind}`}
          </div>
        </div>
      </button>
    </li>
  );
}

/** Modal with an event's raw JSON, its reply chain and its cached blobs */
export default function EventDetails() {
  const { updateSearch } = useSearch();

  createEffect(() => {
    if (!current()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEventDetails();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <Show when={current()} keyed>
      {(event) => {
        const pointer = eventPointer(event);
        const json = JSON.stringify(event, null, 2);
        const blobs = getEventBlobHashes(event);
        const proxy = getBlossomProxyUrl();
        const [ancestors] = createResource(() => loadAncestors(event));
        const search = (query: string) => {
          closeEventDetails();
          updateSearch(query);
        };

        return (
          <Portal>
            <div
              class="modal modal-open"
              role="dialog"
              aria-label="Event details"
              onClick={(e) =>
                e.target === e.currentTarget && closeEventDetails()
              }
            >
              <div class="modal-box max-w-3xl space-y-4">
                <div class="flex items-start gap-3">
                  <UserAvatar pubkey={event.pubkey} size="sm" />
                  <div class="flex-1 min-w-0">
                    <UserName pubkey={event.pubkey} class="font-semibold" />
                    <div class="text-xs text-base-content/60">
                      {KIND_NAMES[event.kind] ?? "kind"} ({event.kind}) ·{" "}
                      {new Date(event.created_at * 1000).toLocaleString()}
                    </div>
                  </div>
                  <button
                    class="btn btn-sm btn-circle btn-ghost"
                    onClick={closeEventDetails}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div class="flex flex-wrap gap-1">
                  <CopyButton
                    value={pointer.value}
                    label={pointer.route === "a" ? "naddr" : "nevent"}
                    class="btn btn-xs"
                  />
                  <CopyButton
                    value={deepLink(pointer.route, pointer.value)}
                    label="link"
                    class="btn btn-xs"
                  />
                  <CopyButton value={json} label="JSON" class="btn btn-xs" />
                  <button
                    class="btn btn-xs"
                    onClick={() =>
                      search(
                        pointer.route === "a"
                          ? addressSearch(event)
                          : `e:${event.id}`,
                      )
                    }
                  >
                    Find replies & references
                  </button>
                  <button
                    class="btn btn-xs"
                    onClick={() =>
                      search(`by:${nip19.npubEncode(event.pubkey)}`)
                    }
                  >
                    More by author
                  </button>
                </div>

                <Show when={(ancestors() ?? []).length > 0}>
                  <section>
                    <h3 class="text-sm font-semibold mb-1">In reply to</h3>
                    <ul class="border-l-2 border-base-300 pl-2">
                      <For each={ancestors()}>
                        {(parent) => (
                          <AncestorRow
                            event={parent}
                            onOpen={() => openEventDetails(parent)}
                          />
                        )}
                      </For>
                    </ul>
                  </section>
                </Show>

                <Show when={blobs.length > 0}>
                  <section>
                    <h3 class="text-sm font-semibold mb-1">
                      Blobs
                      <span class="font-normal text-base-content/50">
                        {" "}
                        · local Blossom cache
                      </span>
                    </h3>
                    <ul class="space-y-1">
                      <For each={blobs}>
                        {(blob) => <BlobRow blob={blob} proxy={proxy} />}
                      </For>
                    </ul>
                  </section>
                </Show>

                <section>
                  <h3 class="text-sm font-semibold mb-1">Raw event</h3>
                  <pre class="bg-base-200 rounded p-3 text-xs overflow-auto max-h-96 whitespace-pre-wrap break-all">
                    {json}
                  </pre>
                </section>
              </div>
            </div>
          </Portal>
        );
      }}
    </Show>
  );
}
