import { createSignal, onCleanup, Show } from "solid-js";
import type { MediaItem } from "../../services/MediaService";
import { createInViewport } from "../previews/createInViewport";

interface VideoTileProps {
  item: MediaItem;
}

/**
 * Poster for a video in a gallery tile. Fills and centres in the tile whatever
 * the video's aspect ratio, and plays a muted preview while hovered. Playback
 * with controls happens in the lightbox, so they are never cropped by the tile.
 */
export default function VideoTile(props: VideoTileProps) {
  const [ref, visible] = createInViewport();
  const [thumbFailed, setThumbFailed] = createSignal(false);
  const [hovered, setHovered] = createSignal(false);
  const [previewing, setPreviewing] = createSignal(false);

  let hoverTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(hoverTimer));

  const thumbnail = () => (!thumbFailed() ? props.item.thumbnail : undefined);

  return (
    <span
      ref={ref}
      class="absolute inset-0 block"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        // Wait for the pointer to rest so sweeping across the grid doesn't fetch every video
        hoverTimer = setTimeout(() => setHovered(true), 350);
      }}
      onPointerLeave={() => {
        clearTimeout(hoverTimer);
        setHovered(false);
        setPreviewing(false);
      }}
    >
      <Show when={visible()}>
        <Show
          when={thumbnail()}
          fallback={
            // No usable thumbnail: show an early frame of the video itself
            <video
              src={`${props.item.url}#t=0.5`}
              preload="metadata"
              muted
              playsinline
              class="h-full w-full object-cover object-center"
            />
          }
        >
          <img
            src={thumbnail()}
            alt={props.item.alt ?? ""}
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover object-center transition-transform group-hover:scale-105"
            onError={() => setThumbFailed(true)}
          />
        </Show>

        {/* Muted hover preview, only fetched once the pointer rests on the tile */}
        <Show when={hovered()}>
          <video
            src={props.item.url}
            muted
            loop
            autoplay
            playsinline
            preload="auto"
            class="absolute inset-0 h-full w-full object-cover object-center transition-opacity"
            classList={{ "opacity-0": !previewing() }}
            onPlaying={() => setPreviewing(true)}
          />
        </Show>
      </Show>

      <span
        class="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity"
        classList={{ "opacity-0": previewing() }}
      >
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="ml-0.5 h-6 w-6"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </span>
  );
}
