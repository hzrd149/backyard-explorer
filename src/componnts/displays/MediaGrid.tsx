import { createMemo, For, Show } from "solid-js";
import {
  extractEventMedia,
  type EventMediaItem,
} from "../../services/MediaService";
import { lightboxClickHandler } from "../Lightbox";
import LazyImage from "../previews/LazyImage";
import ProxiedBadge from "../previews/ProxiedBadge";
import { VideoPreview } from "../previews";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import HiddenResultsNotice from "./HiddenResultsNotice";
import type { DisplayProps } from "./types";

interface MediaGridProps extends DisplayProps {
  /** Which media items to include */
  include: (item: EventMediaItem) => boolean;
  /** Play videos inline in the tile instead of opening them in the lightbox */
  inlineVideo?: boolean;
  /** Tailwind classes for the tile aspect ratio */
  aspect?: string;
  emptyText: string;
}

/** Responsive grid of image / video tiles extracted from a set of events */
export default function MediaGrid(props: MediaGridProps) {
  const extracted = createMemo(() =>
    props.events.map((event) => extractEventMedia(event).filter(props.include)),
  );
  const items = createMemo(() => extracted().flat());
  const hidden = () => extracted().filter((m) => m.length === 0).length;

  const title = (item: EventMediaItem) =>
    item.event.tags.find((t) => t[0] === "title")?.[1] || item.alt;

  return (
    <>
      <Show
        when={items().length > 0}
        fallback={
          <p class="text-center text-base-content/50 mt-8">{props.emptyText}</p>
        }
      >
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          <For each={items()}>
            {(item, index) => (
              <div class="group flex flex-col gap-1">
                <div
                  class={`relative overflow-hidden rounded-lg bg-base-300 ${props.aspect ?? "aspect-square"}`}
                >
                  <Show
                    when={item.kind === "video" && props.inlineVideo}
                    fallback={
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block h-full w-full cursor-zoom-in"
                        onClick={lightboxClickHandler(items, index)}
                      >
                        <Show
                          when={item.kind !== "video" || item.thumbnail}
                          fallback={
                            <video
                              src={item.url}
                              preload="metadata"
                              muted
                              class="h-full w-full object-cover"
                            />
                          }
                        >
                          <LazyImage
                            src={item.thumbnail ?? item.url}
                            fallbackSrc={item.url}
                            alt={item.alt}
                            class="h-full w-full object-cover transition-transform group-hover:scale-105"
                            placeholderClass="h-full w-full"
                          />
                        </Show>
                        <Show when={item.kind === "video"}>
                          <span class="absolute inset-0 flex items-center justify-center">
                            <span class="rounded-full bg-black/60 px-3 py-1 text-lg text-white">
                              ▶
                            </span>
                          </span>
                        </Show>
                      </a>
                    }
                  >
                    <VideoPreview
                      url={item.url}
                      thumbnail={item.thumbnail}
                      alt={item.alt}
                    />
                  </Show>
                  <Show when={item.proxied}>
                    <ProxiedBadge />
                  </Show>
                </div>
                <div class="flex items-center gap-1.5 px-0.5 text-xs text-base-content/70 min-w-0">
                  <UserAvatar pubkey={item.event.pubkey} size="xs" />
                  <span class="truncate">
                    <Show
                      when={title(item)}
                      fallback={
                        <UserName pubkey={item.event.pubkey} maxLength={18} />
                      }
                    >
                      {title(item)}
                    </Show>
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
      <HiddenResultsNotice count={hidden()} />
    </>
  );
}
