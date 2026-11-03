import type { NostrEvent } from "nostr-tools";
import { For, Show } from "solid-js";
import { getPicturePostAttachments } from "applesauce-common/helpers";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import Hashtag from "../Hashtag";
import { resolveMediaItem, type MediaItem } from "../../services/MediaService";
import LazyImage from "../previews/LazyImage";
import ProxiedBadge from "../previews/ProxiedBadge";
import { lightboxClickHandler } from "../Lightbox";

interface PicturePostCardProps {
  picturePost: NostrEvent;
}

export default function PicturePostCard(props: PicturePostCardProps) {
  // Get the title from the title tag
  const titleTag = props.picturePost.tags.find((tag) => tag[0] === "title");
  const title = titleTag?.[1] || "";

  // Get media attachments using the applesauce-core helper
  const rawAttachments = getPicturePostAttachments(props.picturePost);

  // Get all x tags (hashes) from the event
  const hashTags = props.picturePost.tags
    .filter((tag) => tag[0] === "x")
    .map((tag) => tag[1])
    .filter(Boolean);

  // Get all m tags (MIME types) from the event
  const mimeTags = props.picturePost.tags
    .filter((tag) => tag[0] === "m")
    .map((tag) => tag[1])
    .filter(Boolean);

  // Resolve attachments (Blossom proxy + imeta thumbnails). Attachments without
  // a URL fall back to the matching x/m tags so they can be built from the hash.
  const attachments: MediaItem[] = rawAttachments
    .map((attachment, index) =>
      resolveMediaItem(
        attachment.url,
        {
          ...attachment,
          sha256: attachment.sha256 || hashTags[index] || undefined,
          type: attachment.type || mimeTags[index] || undefined,
        },
        props.picturePost.pubkey,
      ),
    )
    .filter((item): item is MediaItem => !!item);
  const openAt = (index: () => number) =>
    lightboxClickHandler(() => attachments, index);

  // Get hashtags
  const hashtags = props.picturePost.tags
    .filter((tag) => tag[0] === "t")
    .map((tag) => tag[1])
    .filter(Boolean);

  // Get tagged users (p tags)
  const taggedUsers = props.picturePost.tags
    .filter((tag) => tag[0] === "p")
    .map((tag) => tag[1])
    .filter(Boolean);

  // Get location if present
  const locationTag = props.picturePost.tags.find(
    (tag) => tag[0] === "location",
  );
  const location = locationTag?.[1];

  // Get content warning if present
  const contentWarningTag = props.picturePost.tags.find(
    (tag) => tag[0] === "content-warning",
  );
  const contentWarning = contentWarningTag?.[1];

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        {/* Header with user info */}
        <div class="flex items-start gap-3 mb-4">
          <UserAvatar pubkey={props.picturePost.pubkey} size="md" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <UserName
                  pubkey={props.picturePost.pubkey}
                  showPubkey={false}
                  maxLength={20}
                  class="font-semibold text-base"
                />
                <div class="badge badge-primary badge-sm">Picture Post</div>
              </div>
              <span class="text-xs text-base-content/50">
                {formatDate(props.picturePost.created_at)}
              </span>
            </div>

            {/* Title */}
            {title && (
              <h3 class="font-medium text-lg text-base-content mb-2">
                {title}
              </h3>
            )}

            {/* Content warning */}
            {contentWarning && (
              <div class="alert alert-warning py-2 px-3 mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current shrink-0 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <span class="text-sm">Content Warning: {contentWarning}</span>
              </div>
            )}
          </div>
        </div>

        {/* Images */}
        {attachments.length > 0 && (
          <div class="mb-4">
            {attachments.length === 1 ? (
              // Single image - display larger
              <div class="relative inline-block">
                <a
                  href={attachments[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="cursor-zoom-in"
                  onClick={openAt(() => 0)}
                >
                  <LazyImage
                    src={attachments[0].url}
                    alt={attachments[0].alt || title || "Picture post"}
                    class="rounded-lg object-cover max-h-[80vh]"
                    placeholderClass="w-[36rem] max-w-full"
                  />
                </a>
                <Show when={attachments[0].proxied}>
                  <ProxiedBadge />
                </Show>
              </div>
            ) : (
              // Multiple images - display in grid
              <div class="grid grid-cols-2 gap-2">
                <For each={attachments.slice(0, 4)}>
                  {(attachment, index) => (
                    <div class="relative aspect-video">
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block w-full h-full cursor-zoom-in"
                        onClick={openAt(index)}
                      >
                        <LazyImage
                          src={attachment.thumbnail ?? attachment.url}
                          fallbackSrc={attachment.url}
                          alt={attachment.alt || `Image ${index() + 1}`}
                          class="w-full h-full rounded-lg object-cover"
                        />
                      </a>
                      <Show when={attachment.proxied}>
                        <ProxiedBadge />
                      </Show>
                    </div>
                  )}
                </For>
                {attachments.length > 4 && (
                  <button
                    class="aspect-video bg-base-200 hover:bg-base-300 rounded-lg flex items-center justify-center cursor-zoom-in"
                    onClick={openAt(() => 4)}
                  >
                    <span class="text-base-content/50 font-medium">
                      +{attachments.length - 4} more
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {props.picturePost.content && (
          <div class="mb-4">
            <p class="text-base-content/80 whitespace-pre-wrap">
              {props.picturePost.content}
            </p>
          </div>
        )}

        {/* Tags and metadata */}
        <div class="flex flex-wrap gap-2 text-sm">
          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div class="flex flex-wrap gap-1">
              <For each={hashtags}>
                {(hashtag) => <Hashtag tag={hashtag} />}
              </For>
            </div>
          )}

          {/* Location */}
          {location && (
            <span class="badge badge-secondary badge-sm">📍 {location}</span>
          )}

          {/* Tagged users */}
          {taggedUsers.length > 0 && (
            <span class="badge badge-accent badge-sm">
              👥 {taggedUsers.length} tagged
            </span>
          )}

          {/* Image count */}
          {attachments.length > 0 && (
            <span class="badge badge-info badge-sm">
              🖼️ {attachments.length} image{attachments.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Footer with event ID */}
        <div class="mt-4 pt-3 border-t border-base-300">
          <div class="flex items-center justify-between text-xs text-base-content/50">
            <span>Event ID: {props.picturePost.id.slice(0, 12)}...</span>
            <span>Kind 20</span>
          </div>
        </div>
      </div>
    </div>
  );
}
