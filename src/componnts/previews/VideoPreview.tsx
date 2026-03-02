import { Show } from "solid-js";

interface VideoPreviewProps {
  url: string;
  thumbnail?: string;
  previewImage?: string;
  alt?: string;
  proxied?: boolean;
}

export default function VideoPreview(props: VideoPreviewProps) {
  return (
    <div class="relative">
      <video
        src={props.url}
        controls
        class="w-full max-h-[80vh] object-cover rounded-lg"
        poster={props.thumbnail || props.previewImage}
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
