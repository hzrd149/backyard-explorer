import { createEffect, createSignal, on } from "solid-js";

interface LazyImageProps {
  src?: string;
  alt?: string;
  /** Classes applied to the image once it has loaded */
  class?: string;
  /** Sizing classes for the loading placeholder (always 16:9) */
  placeholderClass?: string;
  onError?: (e: Event & { currentTarget: HTMLImageElement }) => void;
}

/**
 * Lazy loaded image that shows a 16:9 skeleton while it loads from the Blossom
 * cache or a remote server, then falls back to the image's natural layout.
 */
export default function LazyImage(props: LazyImageProps) {
  const [state, setState] = createSignal<"loading" | "loaded" | "error">(
    "loading",
  );

  createEffect(
    on(
      () => props.src,
      () => setState("loading"),
      { defer: true },
    ),
  );

  const wrapperClass = () => {
    switch (state()) {
      case "loaded":
        // Let the image lay out as if it were a direct child of the parent
        return "contents";
      case "error":
        return "hidden";
      default:
        return `skeleton relative block overflow-hidden rounded-lg aspect-video ${
          props.placeholderClass ?? "w-full"
        }`;
    }
  };

  return (
    <span class={wrapperClass()}>
      <img
        src={props.src}
        alt={props.alt}
        loading="lazy"
        decoding="async"
        ref={(el) => {
          // Cached images may finish before the load handler is attached
          queueMicrotask(() => {
            if (el.complete && el.naturalWidth > 0) setState("loaded");
          });
        }}
        class={
          state() === "loaded"
            ? props.class
            : "absolute inset-0 h-full w-full object-cover opacity-0"
        }
        onLoad={() => setState("loaded")}
        onError={(e) => {
          setState("error");
          props.onError?.(e);
        }}
      />
    </span>
  );
}
