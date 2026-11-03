import type { NostrEvent } from "nostr-tools";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { MARKET_KINDS } from "../../services/DisplayService";
import type { MediaItem } from "../../services/MediaService";
import { lightboxClickHandler } from "../Lightbox";
import LazyImage from "../previews/LazyImage";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import Hashtag from "../Hashtag";
import HiddenResultsNotice from "./HiddenResultsNotice";
import { eventLink, formatDate, tagValue } from "./format";
import type { DisplayProps } from "./types";

interface Listing {
  event: NostrEvent;
  title: string;
  summary?: string;
  description: string;
  /** Numeric price, when it parses */
  amount?: number;
  /** The price as written, for prices that don't parse */
  priceText?: string;
  currency?: string;
  /** e.g. "month" for rentals */
  frequency?: string;
  location?: string;
  sold: boolean;
  draft: boolean;
  images: string[];
  hashtags: string[];
  published: number;
}

type Sort = "newest" | "price-asc" | "price-desc";

/** NIP-15 products describe themselves with JSON content */
function parseProduct(event: NostrEvent) {
  try {
    const data = JSON.parse(event.content);
    return typeof data === "object" && data ? data : {};
  } catch {
    return {};
  }
}

const cache = new WeakMap<NostrEvent, Listing>();

function toListing(event: NostrEvent): Listing {
  let listing = cache.get(event);
  if (listing) return listing;

  const hashtags = event.tags
    .filter((t) => t[0] === "t" && t[1])
    .map((t) => t[1]);

  if (event.kind === 30018) {
    const product = parseProduct(event);
    const amount = Number(product.price);
    listing = {
      event,
      title: String(product.name ?? "Untitled product"),
      description: String(product.description ?? ""),
      amount: Number.isFinite(amount) ? amount : undefined,
      currency: product.currency ? String(product.currency) : undefined,
      sold: product.quantity === 0,
      draft: false,
      images: Array.isArray(product.images)
        ? product.images.filter((i: unknown) => typeof i === "string")
        : [],
      hashtags,
      published: event.created_at,
    };
  } else {
    // NIP-99: ["price", "<amount>", "<currency>", "<frequency>"]
    const price = event.tags.find((t) => t[0] === "price");
    const amount = price?.[1] ? Number(price[1]) : NaN;
    const published = parseInt(tagValue(event, "published_at") ?? "", 10);
    listing = {
      event,
      title: tagValue(event, "title") ?? "Untitled listing",
      summary: tagValue(event, "summary"),
      description: event.content,
      amount: Number.isFinite(amount) ? amount : undefined,
      priceText: price?.[1],
      currency: price?.[2],
      frequency: price?.[3],
      location: tagValue(event, "location"),
      sold: tagValue(event, "status") === "sold",
      draft: event.kind === 30403,
      images: event.tags
        .filter((t) => t[0] === "image" && t[1])
        .map((t) => t[1]),
      hashtags,
      published: Number.isFinite(published) ? published : event.created_at,
    };
  }
  cache.set(event, listing);
  return listing;
}

const SATS = ["sat", "sats", "msat"];

/** A price in the listing's currency, using the locale's format for ISO currencies */
export function formatPrice(listing: Listing): string | undefined {
  if (listing.amount === undefined) return listing.priceText;
  const currency = listing.currency?.toUpperCase();
  let text: string;
  if (!currency) text = listing.amount.toLocaleString();
  else if (SATS.includes(currency.toLowerCase()))
    text = `${listing.amount.toLocaleString()} sats`;
  else {
    try {
      text = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
      }).format(listing.amount);
    } catch {
      // Not an ISO 4217 code, e.g. BTC
      text = `${listing.amount.toLocaleString()} ${currency}`;
    }
  }
  return listing.frequency ? `${text} / ${listing.frequency}` : text;
}

const currencyOf = (l: Listing) => l.currency?.toUpperCase() ?? "";

/** Product cards for classified listings (NIP-99) and marketplace products (NIP-15) */
export default function MarketDisplay(props: DisplayProps) {
  const [sort, setSort] = createSignal<Sort>("newest");
  const [currency, setCurrency] = createSignal<string | null>(null);
  const [hideSold, setHideSold] = createSignal(false);
  const [open, setOpen] = createSignal<Listing | null>(null);

  const listings = createMemo(() =>
    props.events.filter((e) => MARKET_KINDS.includes(e.kind)).map(toListing),
  );
  const currencies = createMemo(() => {
    const counts = new Map<string, number>();
    for (const l of listings())
      if (l.amount !== undefined && l.currency)
        counts.set(currencyOf(l), (counts.get(currencyOf(l)) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  });

  const shown = createMemo(() => {
    let list = listings();
    if (hideSold()) list = list.filter((l) => !l.sold);
    const only = currency();
    if (only) list = list.filter((l) => currencyOf(l) === only);
    const s = sort();
    if (s === "newest")
      return [...list].sort((a, b) => b.published - a.published);
    // Prices only compare within a currency: group by currency, unpriced last
    const dir = s === "price-asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (a.amount === undefined || b.amount === undefined)
        return a.amount === undefined ? (b.amount === undefined ? 0 : 1) : -1;
      return (
        currencyOf(a).localeCompare(currencyOf(b)) ||
        (a.amount - b.amount) * dir
      );
    });
  });

  return (
    <>
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <select
          class="select select-sm w-auto"
          value={sort()}
          onChange={(e) => setSort(e.currentTarget.value as Sort)}
        >
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
        <Show when={currencies().length > 1}>
          <div class="flex flex-wrap gap-1">
            <button
              class="btn btn-xs"
              classList={{ "btn-primary": currency() === null }}
              onClick={() => setCurrency(null)}
            >
              All currencies
            </button>
            <For each={currencies()}>
              {([code, count]) => (
                <button
                  class="btn btn-xs"
                  classList={{ "btn-primary": currency() === code }}
                  onClick={() => setCurrency(currency() === code ? null : code)}
                >
                  {code} <span class="opacity-60">{count}</span>
                </button>
              )}
            </For>
          </div>
        </Show>
        <label class="label ml-auto cursor-pointer gap-2 text-sm">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            checked={hideSold()}
            onChange={(e) => setHideSold(e.currentTarget.checked)}
          />
          Hide sold
        </label>
      </div>
      <Show
        when={sort() !== "newest" && currencies().length > 1 && !currency()}
      >
        <p class="mb-3 text-xs text-base-content/60">
          Prices are sorted within each currency.
        </p>
      </Show>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <For each={shown()}>
          {(listing) => (
            <article
              class="card cursor-pointer overflow-hidden border border-base-300 bg-base-100 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => setOpen(listing)}
            >
              <figure class="relative aspect-square bg-base-300">
                <Show
                  when={listing.images[0]}
                  fallback={<span class="text-4xl opacity-40">🛍️</span>}
                >
                  <LazyImage
                    src={listing.images[0]}
                    alt={listing.title}
                    class="h-full w-full object-cover object-center"
                    placeholderClass="h-full w-full rounded-none"
                  />
                </Show>
                <Show when={listing.sold}>
                  <span class="badge badge-neutral absolute left-2 top-2">
                    Sold
                  </span>
                </Show>
                <Show when={listing.draft}>
                  <span class="badge badge-ghost absolute right-2 top-2">
                    Draft
                  </span>
                </Show>
              </figure>
              <div class="card-body gap-1 p-3">
                <h3 class="line-clamp-2 text-sm font-semibold">
                  {listing.title}
                </h3>
                <Show when={formatPrice(listing)}>
                  <div
                    class="font-bold text-primary"
                    classList={{ "line-through opacity-60": listing.sold }}
                  >
                    {formatPrice(listing)}
                  </div>
                </Show>
                <Show when={listing.location}>
                  <div class="truncate text-xs text-base-content/60">
                    📍 {listing.location}
                  </div>
                </Show>
                <div class="mt-auto flex items-center gap-1.5 pt-1 text-xs text-base-content/60">
                  <UserAvatar pubkey={listing.event.pubkey} size="xs" />
                  <UserName
                    pubkey={listing.event.pubkey}
                    maxLength={16}
                    clickable={false}
                  />
                </div>
              </div>
            </article>
          )}
        </For>
      </div>

      <Show when={props.complete && shown().length === 0}>
        <p class="text-center text-base-content/50 mt-8">
          No listings found in these results.
        </p>
      </Show>
      <HiddenResultsNotice count={props.events.length - listings().length} />

      <Show when={open()}>
        {(listing) => (
          <ListingDetail listing={listing()} onClose={() => setOpen(null)} />
        )}
      </Show>
    </>
  );
}

function ListingDetail(props: { listing: Listing; onClose: () => void }) {
  const media = (): MediaItem[] =>
    props.listing.images.map((url) => ({
      url,
      proxied: false,
      alt: props.listing.title,
    }));

  return (
    <Portal>
      <div
        class="fixed inset-0 z-[90] flex justify-center overflow-y-auto bg-black/60 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div class="my-8 h-fit w-full max-w-3xl rounded-box bg-base-100 p-6 shadow-xl">
          <div class="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold">{props.listing.title}</h2>
              <Show when={formatPrice(props.listing)}>
                <div class="text-xl font-bold text-primary">
                  {formatPrice(props.listing)}
                  <Show when={props.listing.sold}>
                    <span class="badge badge-neutral ml-2 align-middle">
                      Sold
                    </span>
                  </Show>
                </div>
              </Show>
            </div>
            <button
              class="btn btn-ghost btn-sm btn-circle"
              onClick={() => props.onClose()}
              title="Close"
            >
              ✕
            </button>
          </div>

          <Show when={props.listing.images.length > 0}>
            <div class="mb-4 flex gap-2 overflow-x-auto pb-1">
              <For each={props.listing.images}>
                {(url, index) => (
                  <a
                    href={url}
                    class="h-40 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-base-300"
                    onClick={lightboxClickHandler(media, index)}
                  >
                    <LazyImage
                      src={url}
                      alt=""
                      class="h-40 w-auto object-cover"
                      placeholderClass="h-40 w-40"
                    />
                  </a>
                )}
              </For>
            </div>
          </Show>

          <div class="mb-4 flex flex-wrap items-center gap-2 text-sm text-base-content/70">
            <UserAvatar pubkey={props.listing.event.pubkey} size="sm" />
            <UserName pubkey={props.listing.event.pubkey} />
            <span>· {formatDate(props.listing.published)}</span>
            <Show when={props.listing.location}>
              <span>· 📍 {props.listing.location}</span>
            </Show>
            <a
              href={eventLink(props.listing.event)}
              class="link link-primary ml-auto"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in client
            </a>
          </div>

          <Show when={props.listing.summary}>
            <p class="mb-3 font-medium">{props.listing.summary}</p>
          </Show>
          <div class="whitespace-pre-wrap break-words leading-relaxed">
            {props.listing.description}
          </div>
          <Show when={props.listing.hashtags.length > 0}>
            <div class="mt-4 flex flex-wrap gap-1">
              <For each={props.listing.hashtags}>
                {(tag) => <Hashtag tag={tag} />}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </Portal>
  );
}
