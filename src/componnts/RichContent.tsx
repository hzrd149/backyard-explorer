import { For, Show } from "solid-js";
import {
  getParsedContent,
  links,
  galleries,
  nostrMentions,
} from "applesauce-content/text";
import type { Content } from "applesauce-content/nast";
import {
  isImageURL,
  isVideoURL,
  getPubkeyFromDecodeResult,
} from "applesauce-core/helpers";
import {
  isBud01Url,
  transformBlossomUrl,
  isBlossomProxiedUrl,
} from "../services/BlossomService.ts";
import { ImagePreview, VideoPreview } from "./previews/index.ts";
import UserName from "./UserName.tsx";

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
      const proxied = isBlossomProxiedUrl(resolved);

      if (isImageURL(raw)) {
        return (
          <div class="mt-2">
            <ImagePreview url={resolved} proxied={proxied} />
          </div>
        );
      }

      if (isVideoURL(raw)) {
        return (
          <div class="mt-2">
            <VideoPreview url={resolved} proxied={proxied} />
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
      const resolvedLinks = node.links.map((url) => ({
        url: resolveUrl(url, pubkey),
        proxied: isBlossomProxiedUrl(resolveUrl(url, pubkey)),
      }));
      return (
        <div class="mt-2 flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
          <For each={resolvedLinks}>
            {(item) => (
              <div class="flex-none snap-start relative">
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={item.url}
                    class="h-48 w-auto min-w-48 rounded-lg object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget
                        .closest(".relative")!
                        .setAttribute("style", "display:none");
                    }}
                  />
                </a>
                <Show when={item.proxied}>
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
            )}
          </For>
        </div>
      );
    }

    case "mention": {
      const mentionedPubkey = getPubkeyFromDecodeResult(node.decoded);
      if (mentionedPubkey) {
        return (
          <span class="inline-flex items-baseline">
            <span class="text-primary">@</span>
            <UserName pubkey={mentionedPubkey} class="text-primary" />
          </span>
        );
      }
      // Non-pubkey mention (nevent, naddr, note) — show a truncated identifier
      return (
        <span class="font-mono text-xs text-base-content/50">
          {node.encoded.slice(0, 12)}…
        </span>
      );
    }

    // Ignore types we don't render (hashtags, etc.)
    default:
      return null;
  }
}

export default function RichContent(props: RichContentProps) {
  const parsed = () =>
    getParsedContent(
      props.content,
      undefined,
      [links, nostrMentions, galleries],
      null,
    );

  return (
    <div class="prose prose-sm max-w-none break-words">
      <For each={parsed().children}>
        {(node) => renderNode(node, props.pubkey)}
      </For>
    </div>
  );
}
