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
import type { FileMetadataFields } from "applesauce-common/helpers";
import {
  isBud01Url,
  transformBlossomUrl,
  isBlossomProxiedUrl,
} from "../services/BlossomService.ts";
import {
  findAttachmentForUrl,
  resolveMediaItem,
  type MediaItem,
} from "../services/MediaService.ts";
import { ImagePreview, VideoPreview } from "./previews/index.ts";
import UserName from "./UserName.tsx";
import LazyImage from "./previews/LazyImage.tsx";
import ProxiedBadge from "./previews/ProxiedBadge.tsx";
import { lightboxClickHandler } from "./Lightbox.tsx";

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
  /** NIP-92 imeta attachments from the event, used for thumbnails and alt text */
  attachments?: FileMetadataFields[];
}

function renderNode(node: Content, props: RichContentProps) {
  const { pubkey, attachments } = props;
  const media = (url: string): MediaItem =>
    resolveMediaItem(url, findAttachmentForUrl(attachments, url), pubkey) ?? {
      url: resolveUrl(url, pubkey),
      proxied: isBlossomProxiedUrl(resolveUrl(url, pubkey)),
    };

  switch (node.type) {
    case "text":
      return <span style="white-space: pre-wrap">{node.value}</span>;

    case "link": {
      const raw = node.href;

      if (isImageURL(raw)) {
        const item = media(raw);
        return (
          <div class="mt-2">
            <ImagePreview
              url={item.url}
              alt={item.alt}
              proxied={item.proxied}
              onOpen={lightboxClickHandler(
                () => [item],
                () => 0,
              )}
            />
          </div>
        );
      }

      if (isVideoURL(raw)) {
        const item = media(raw);
        return (
          <div class="mt-2">
            <VideoPreview
              url={item.url}
              thumbnail={item.thumbnail}
              alt={item.alt}
              proxied={item.proxied}
            />
          </div>
        );
      }

      const resolved = resolveUrl(raw, pubkey);
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
      const items = node.links.map(media);
      return (
        <div class="mt-2 flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory">
          <For each={items}>
            {(item, index) => (
              <div class="flex-none snap-start relative">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="cursor-zoom-in"
                  onClick={lightboxClickHandler(() => items, index)}
                >
                  <LazyImage
                    src={item.thumbnail ?? item.url}
                    fallbackSrc={item.url}
                    alt={item.alt}
                    class="h-48 w-auto min-w-48 rounded-lg object-cover"
                    placeholderClass="h-48"
                    onError={(e) => {
                      e.currentTarget
                        .closest(".relative")!
                        .setAttribute("style", "display:none");
                    }}
                  />
                </a>
                <Show when={item.proxied}>
                  <ProxiedBadge />
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
      <For each={parsed().children}>{(node) => renderNode(node, props)}</For>
    </div>
  );
}
