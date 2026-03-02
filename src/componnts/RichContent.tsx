import { For } from "solid-js";
import { getParsedContent, links, galleries } from "applesauce-content/text";
import type { Content } from "applesauce-content/nast";
import { isImageURL, isVideoURL } from "applesauce-core/helpers";
import { isBud01Url, transformBlossomUrl } from "../services/BlossomService.ts";
import { ImagePreview, VideoPreview } from "./previews/index.ts";

/**
 * Resolve the display URL — applies the Blossom proxy when the URL is a
 * BUD-01 Blossom URL and a proxy is configured.
 */
function resolveUrl(url: string, pubkey?: string): string {
  if (isBud01Url(url)) {
    return transformBlossomUrl(url, { pubkey }) ?? url;
  }
  return url;
}

interface RichContentProps {
  content: string;
  /** Author pubkey — forwarded to the Blossom proxy as the `as` parameter */
  pubkey?: string;
}

function renderNode(node: Content, pubkey: string | undefined) {
  switch (node.type) {
    case "text":
      return <span style="white-space: pre-wrap">{node.value}</span>;

    case "link": {
      const raw = node.href;
      const resolved = resolveUrl(raw, pubkey);

      if (isImageURL(raw)) {
        return (
          <div class="mt-2">
            <ImagePreview url={resolved} />
          </div>
        );
      }

      if (isVideoURL(raw)) {
        return (
          <div class="mt-2">
            <VideoPreview url={resolved} />
          </div>
        );
      }

      return (
        <a
          href={resolved}
          target="_blank"
          rel="noopener noreferrer"
          class="link link-primary"
        >
          {node.value}
        </a>
      );
    }

    case "gallery": {
      const resolvedLinks = node.links.map((url) => resolveUrl(url, pubkey));
      return (
        <div class="mt-2 flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
          <For each={resolvedLinks}>
            {(url) => (
              <div class="flex-none snap-start">
                <img
                  src={url}
                  class="h-48 w-auto rounded-lg object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </For>
        </div>
      );
    }

    // Ignore types we don't render (mentions, hashtags, etc.)
    default:
      return null;
  }
}

export default function RichContent(props: RichContentProps) {
  const parsed = () =>
    getParsedContent(props.content, undefined, [links, galleries], null);

  return (
    <div class="prose prose-sm max-w-none break-words">
      <For each={parsed().children}>
        {(node) => renderNode(node, props.pubkey)}
      </For>
    </div>
  );
}
