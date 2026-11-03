import { createSignal, Show } from "solid-js";
import { createInViewport, pauseWhenOffscreen } from "./createInViewport";

interface VideoPreviewProps {
  url: string;
  thumbnail?: string;
  previewImage?: string;
  alt?: string;
  proxied?: boolean;
}

export default function VideoPreview(props: VideoPreviewProps) {
  // Don't attach src/poster until the video is near the viewport, and even then
  // only fetch metadata so the Blossom cache isn't asked for every video in the feed.
  const [ref, visible] = createInViewport();
  // Hold a 16:9 placeholder until the video's dimensions are known
  const [ready, setReady] = createSignal(false);

  return (
    <div class="relative" ref={ref}>
      <video
        ref={pauseWhenOffscreen}
        src={visible() ? props.url : undefined}
        controls
        preload={visible() ? "metadata" : "none"}
        class="w-full max-h-[80vh] object-contain bg-black rounded-lg"
        classList={{ "aspect-video skeleton": !ready() }}
        onLoadedMetadata={() => setReady(true)}
        poster={visible() ? props.thumbnail || props.previewImage : undefined}
      >
        Your browser does not support the video tag.
      </video>
      <Show when={props.proxied}>
        <div
          class="absolute top-1.5 right-1.5 bg-success text-success-content rounded-full p-0.5 shadow"
          title="Served via local Blossom proxy"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
      </Show>
    </div>
  );
}
