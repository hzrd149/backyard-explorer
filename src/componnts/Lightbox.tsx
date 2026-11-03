import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { MediaItem } from "../services/MediaService";

interface LightboxState {
  items: MediaItem[];
  index: number;
}

const [lightbox, setLightbox] = createSignal<LightboxState | null>(null);

/** Open the lightbox on a set of images, starting at `index` */
export function openLightbox(items: MediaItem[], index = 0) {
  if (items.length === 0) return;
  setLightbox({
    items,
    index: Math.min(Math.max(index, 0), items.length - 1),
  });
}

export function closeLightbox() {
  setLightbox(null);
}

/**
 * Click handler for an `<a>` wrapping an image: opens the lightbox on a normal
 * click, but leaves modifier / middle clicks alone so "open in new tab" works.
 */
export function lightboxClickHandler(
  items: () => MediaItem[],
  index: () => number,
) {
  return (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    e.preventDefault();
    openLightbox(items(), index());
  };
}

function step(delta: number) {
  setLightbox((s) => {
    if (!s || s.items.length < 2) return s;
    const index = (s.index + delta + s.items.length) % s.items.length;
    return { ...s, index };
  });
}

function goTo(index: number) {
  setLightbox((s) => (s ? { ...s, index } : s));
}

/** Mount once at the app root */
export default function Lightbox() {
  const current = () => {
    const s = lightbox();
    return s ? s.items[s.index] : undefined;
  };
  const count = () => lightbox()?.items.length ?? 0;

  const [loaded, setLoaded] = createSignal(false);
  createEffect(on(current, () => setLoaded(false)));

  // Keyboard navigation + scroll lock while open
  createEffect(() => {
    if (!lightbox()) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);

    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    });
  });

  // Basic horizontal swipe for touch screens
  let touchX: number | null = null;
  const onTouchStart = (e: TouchEvent) => {
    touchX = e.touches.length === 1 ? e.touches[0].clientX : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  };

  return (
    <Show when={current()}>
      {(item) => (
        <Portal>
          <div
            class="fixed inset-0 z-[100] flex flex-col bg-black/90 select-none"
            role="dialog"
            aria-modal="true"
            aria-label="Media viewer"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeLightbox();
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Top bar */}
            <div class="flex items-center justify-between gap-2 p-3 text-white">
              <span class="text-sm opacity-70">
                <Show when={count() > 1}>
                  {lightbox()!.index + 1} / {count()}
                </Show>
              </span>
              <div class="flex items-center gap-1">
                <a
                  href={item().url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn-ghost btn-sm btn-circle text-white"
                  title="Open original"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
                <button
                  class="btn btn-ghost btn-sm btn-circle text-white"
                  onClick={closeLightbox}
                  title="Close (Esc)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Image */}
            <div
              class="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeLightbox();
              }}
            >
              <Show
                when={item().kind === "video"}
                fallback={
                  <>
                    {/* Show the imeta thumbnail while the full image loads */}
                    <Show when={!loaded()}>
                      <Show
                        when={item().thumbnail}
                        fallback={
                          <span class="loading loading-spinner loading-lg text-white" />
                        }
                      >
                        <img
                          src={item().thumbnail}
                          alt=""
                          class="absolute max-h-full max-w-full object-contain blur-sm"
                        />
                      </Show>
                    </Show>
                    <img
                      src={item().url}
                      alt={item().alt ?? ""}
                      class="max-h-full max-w-full object-contain transition-opacity"
                      classList={{ "opacity-0 absolute": !loaded() }}
                      ref={(el) =>
                        queueMicrotask(() => {
                          if (el.complete && el.naturalWidth > 0)
                            setLoaded(true);
                        })
                      }
                      onLoad={() => setLoaded(true)}
                    />
                  </>
                }
              >
                <video
                  src={item().url}
                  poster={item().thumbnail}
                  controls
                  autoplay
                  playsinline
                  class="max-h-full max-w-full object-contain"
                />
              </Show>

              <Show when={count() > 1}>
                <button
                  class="btn btn-circle absolute left-2 top-1/2 -translate-y-1/2 border-none bg-black/50 text-white hover:bg-black/70"
                  onClick={() => step(-1)}
                  title="Previous (←)"
                >
                  ‹
                </button>
                <button
                  class="btn btn-circle absolute right-2 top-1/2 -translate-y-1/2 border-none bg-black/50 text-white hover:bg-black/70"
                  onClick={() => step(1)}
                  title="Next (→)"
                >
                  ›
                </button>
              </Show>
            </div>

            {/* Caption */}
            <Show when={item().alt}>
              <p class="mx-auto max-w-3xl px-4 pt-2 text-center text-sm text-white/80">
                {item().alt}
              </p>
            </Show>

            {/* Thumbnail strip */}
            <Show when={count() > 1}>
              <div class="flex justify-center gap-2 overflow-x-auto p-3">
                <For each={lightbox()!.items}>
                  {(thumb, i) => (
                    <button
                      class="h-14 w-14 flex-none overflow-hidden rounded border-2 transition-opacity"
                      classList={{
                        "border-white": i() === lightbox()!.index,
                        "border-transparent opacity-50 hover:opacity-100":
                          i() !== lightbox()!.index,
                      }}
                      onClick={() => goTo(i())}
                    >
                      <Show
                        when={thumb.kind !== "video" || thumb.thumbnail}
                        fallback={
                          <span class="flex h-full w-full items-center justify-center bg-white/10 text-white">
                            ▶
                          </span>
                        }
                      >
                        <span class="relative block h-full w-full">
                          <img
                            src={thumb.thumbnail ?? thumb.url}
                            alt=""
                            loading="lazy"
                            class="h-full w-full object-cover"
                          />
                          <Show when={thumb.kind === "video"}>
                            <span class="absolute inset-0 flex items-center justify-center text-white drop-shadow">
                              ▶
                            </span>
                          </Show>
                        </span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Portal>
      )}
    </Show>
  );
}
