import { Show } from "solid-js";

interface ImagePreviewProps {
  url: string;
  alt?: string;
  dimensions?: string;
  proxied?: boolean;
}

export default function ImagePreview(props: ImagePreviewProps) {
  return (
    <div class="relative inline-block">
      <a href={props.url} target="_blank" rel="noopener noreferrer">
        <img
          src={props.url}
          alt={props.alt || "Image preview"}
          class="rounded-lg max-h-[80vh]"
          loading="lazy"
          onError={(e) => {
            e.currentTarget
              .closest(".relative")!
              .setAttribute("style", "display:none");
          }}
        />
      </a>
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
