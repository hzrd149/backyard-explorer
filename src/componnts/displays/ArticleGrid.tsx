import type { NostrEvent } from "nostr-tools";
import { naddrEncode } from "nostr-tools/nip19";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import {
  getArticleImage,
  getArticlePublished,
  getArticleSummary,
  getArticleTitle,
} from "applesauce-common/helpers";
import LazyImage from "../previews/LazyImage";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import Hashtag from "../Hashtag";
import HiddenResultsNotice from "./HiddenResultsNotice";
import { formatDate } from "./format";
import type { DisplayProps } from "./types";

function articleLink(article: NostrEvent): string | undefined {
  const identifier = article.tags.find((t) => t[0] === "d")?.[1];
  if (identifier === undefined) return undefined;
  try {
    return `nostr:${naddrEncode({ kind: article.kind, pubkey: article.pubkey, identifier })}`;
  } catch {
    return undefined;
  }
}

/** Magazine-style grid of long-form articles with an in-app reader */
export default function ArticleGrid(props: DisplayProps) {
  const articles = createMemo(() =>
    props.events.filter((e) => e.kind === 30023 || e.kind === 30818),
  );
  const [reading, setReading] = createSignal<NostrEvent | null>(null);

  return (
    <>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <For each={articles()}>
          {(article) => {
            const image = getArticleImage(article);
            const title = getArticleTitle(article) || "Untitled";
            const summary =
              getArticleSummary(article) || article.content.slice(0, 280);
            const hashtags = article.tags
              .filter((t) => t[0] === "t" && t[1])
              .slice(0, 3);
            return (
              <article
                class="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                onClick={() => setReading(article)}
              >
                <Show
                  when={image}
                  fallback={
                    <div class="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-4xl">
                      📖
                    </div>
                  }
                >
                  <figure class="aspect-video">
                    <LazyImage
                      src={image}
                      alt={title}
                      class="h-full w-full object-cover"
                      placeholderClass="h-full w-full rounded-none"
                    />
                  </figure>
                </Show>
                <div class="card-body p-4 gap-2">
                  <h3 class="card-title text-base line-clamp-2">{title}</h3>
                  <p class="text-sm text-base-content/70 line-clamp-3">
                    {summary}
                  </p>
                  <div class="flex flex-wrap gap-1">
                    <For each={hashtags}>{(t) => <Hashtag tag={t[1]} />}</For>
                  </div>
                  <div class="mt-auto flex items-center gap-2 pt-2 text-xs text-base-content/60">
                    <UserAvatar pubkey={article.pubkey} size="xs" />
                    <UserName pubkey={article.pubkey} maxLength={18} />
                    <span class="ml-auto">
                      {formatDate(getArticlePublished(article))}
                    </span>
                  </div>
                </div>
              </article>
            );
          }}
        </For>
      </div>

      <Show when={props.complete && articles().length === 0}>
        <p class="text-center text-base-content/50 mt-8">
          No articles found in these results.
        </p>
      </Show>
      <HiddenResultsNotice count={props.events.length - articles().length} />

      {/* Reader */}
      <Show when={reading()}>
        {(article) => (
          <Portal>
            <div
              class="fixed inset-0 z-[90] flex justify-center overflow-y-auto bg-black/60 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setReading(null);
              }}
            >
              <div class="my-8 h-fit w-full max-w-3xl rounded-box bg-base-100 p-6 shadow-xl">
                <div class="mb-4 flex items-start justify-between gap-4">
                  <h2 class="text-2xl font-bold">
                    {getArticleTitle(article()) || "Untitled"}
                  </h2>
                  <button
                    class="btn btn-ghost btn-sm btn-circle"
                    onClick={() => setReading(null)}
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
                <div class="mb-4 flex items-center gap-2 text-sm text-base-content/70">
                  <UserAvatar pubkey={article().pubkey} size="sm" />
                  <UserName pubkey={article().pubkey} />
                  <span>· {formatDate(getArticlePublished(article()))}</span>
                  <Show when={articleLink(article())}>
                    <a
                      href={articleLink(article())}
                      class="link link-primary ml-auto"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in client
                    </a>
                  </Show>
                </div>
                <div class="whitespace-pre-wrap break-words leading-relaxed">
                  {article().content}
                </div>
              </div>
            </div>
          </Portal>
        )}
      </Show>
    </>
  );
}
