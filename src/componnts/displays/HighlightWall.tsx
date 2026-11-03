import { createMemo, For, Show } from "solid-js";
import { neventEncode, naddrEncode } from "nostr-tools/nip19";
import {
  getHighlightComment,
  getHighlightContext,
  getHighlightSourceAddressPointer,
  getHighlightSourceEventPointer,
  getHighlightSourceUrl,
  getHighlightText,
} from "applesauce-common/helpers";
import type { NostrEvent } from "nostr-tools";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import HiddenResultsNotice from "./HiddenResultsNotice";
import { formatDate } from "./format";
import type { DisplayProps } from "./types";

/** Where a highlight came from, as a link target and display label */
function highlightSource(
  event: NostrEvent,
): { href: string; label: string } | undefined {
  const url = getHighlightSourceUrl(event);
  if (url) {
    let label = url;
    try {
      label = new URL(url).hostname;
    } catch {
      // keep raw url
    }
    return { href: url, label };
  }
  const address = getHighlightSourceAddressPointer(event);
  if (address)
    return { href: `nostr:${naddrEncode(address)}`, label: "Nostr article" };
  const pointer = getHighlightSourceEventPointer(event);
  if (pointer)
    return { href: `nostr:${neventEncode(pointer)}`, label: "Nostr event" };
  return undefined;
}

/** Masonry wall of NIP-84 highlights */
export default function HighlightWall(props: DisplayProps) {
  const highlights = createMemo(() =>
    props.events.filter((e) => e.kind === 9802),
  );

  return (
    <>
      <div class="columns-1 sm:columns-2 lg:columns-3 gap-4">
        <For each={highlights()}>
          {(event) => {
            const text = getHighlightText(event);
            const context = getHighlightContext(event);
            const comment = getHighlightComment(event);
            const source = highlightSource(event);
            return (
              <figure class="mb-4 break-inside-avoid rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
                <blockquote class="border-l-4 border-warning pl-3 font-serif text-lg leading-snug">
                  <mark class="bg-warning/30 text-base-content">{text}</mark>
                </blockquote>
                <Show when={context && context !== text}>
                  <p class="mt-2 text-xs text-base-content/50 line-clamp-3 italic">
                    …{context}…
                  </p>
                </Show>
                <Show when={comment}>
                  <p class="mt-3 text-sm text-base-content/80">{comment}</p>
                </Show>
                <figcaption class="mt-3 flex items-center gap-2 text-xs text-base-content/60">
                  <UserAvatar pubkey={event.pubkey} size="xs" />
                  <UserName pubkey={event.pubkey} maxLength={16} />
                  <span>· {formatDate(event.created_at)}</span>
                  <Show when={source}>
                    <a
                      href={source!.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link ml-auto truncate max-w-[40%]"
                      title={source!.href}
                    >
                      {source!.label}
                    </a>
                  </Show>
                </figcaption>
              </figure>
            );
          }}
        </For>
      </div>
      <Show when={highlights().length === 0}>
        <p class="text-center text-base-content/50 mt-8">
          No highlights found in these results.
        </p>
      </Show>
      <HiddenResultsNotice count={props.events.length - highlights().length} />
    </>
  );
}
