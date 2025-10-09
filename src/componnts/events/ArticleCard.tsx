import type { NostrEvent } from "nostr-tools";
import { naddrEncode } from "nostr-tools/nip19";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";

interface ArticleCardProps {
  article: NostrEvent;
}

export default function ArticleCard(props: ArticleCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Extract metadata from tags
  const getTagValue = (tagName: string): string | undefined => {
    const tag = props.article.tags?.find((tag) => tag[0] === tagName);
    return tag?.[1];
  };

  const title = getTagValue("title");
  const summary = getTagValue("summary");
  const image = getTagValue("image");
  const publishedAt = getTagValue("published_at");
  const identifier = getTagValue("d");

  // Generate naddr for linking
  const generateNaddr = (): string => {
    if (!identifier) return "";
    try {
      const naddr = naddrEncode({
        kind: 30023,
        pubkey: props.article.pubkey,
        identifier: identifier,
      });
      return `nostr:${naddr}`;
    } catch (error) {
      console.error("Error generating naddr:", error);
      return "";
    }
  };

  const naddr = generateNaddr();

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        <div class="flex items-start gap-3">
          <UserAvatar pubkey={props.article.pubkey} size="sm" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <UserName
                  pubkey={props.article.pubkey}
                  showPubkey={false}
                  maxLength={15}
                  class="font-medium"
                />
                <div class="badge badge-outline text-xs">Article</div>
              </div>
              <span class="text-xs text-base-content/50">
                {publishedAt
                  ? formatDate(parseInt(publishedAt))
                  : formatDate(props.article.created_at)}
              </span>
            </div>

            {/* Article Image */}
            {image && (
              <div class="mb-3">
                <img
                  src={image}
                  alt={title || "Article image"}
                  class="w-full h-32 object-cover rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}

            {/* Article Title */}
            {title && (
              <h3 class="text-lg font-semibold mb-2 line-clamp-2">{title}</h3>
            )}

            {/* Article Summary */}
            {summary && (
              <p class="text-base-content/70 text-sm mb-3 line-clamp-3">
                {summary}
              </p>
            )}

            {/* Article Tags */}
            {props.article.tags && props.article.tags.length > 0 && (
              <div class="flex flex-wrap gap-1 mb-3">
                {props.article.tags
                  .filter((tag) => tag[0] === "t" && tag[1])
                  .slice(0, 5)
                  .map((tag) => (
                    <span class="badge badge-ghost badge-sm">#{tag[1]}</span>
                  ))}
              </div>
            )}

            {/* Read More Link */}
            {naddr && (
              <div class="flex justify-end">
                <a
                  href={naddr}
                  class="btn btn-primary btn-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read Article
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
