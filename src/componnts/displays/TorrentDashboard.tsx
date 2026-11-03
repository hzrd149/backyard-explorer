import type { NostrEvent } from "nostr-tools";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  getTorrentCategoryPath,
  getTorrentFiles,
  getTorrentInfoHash,
  getTorrentMagnetLink,
  getTorrentSearchTags,
  getTorrentTitle,
  type TorrentFile,
} from "applesauce-common/helpers";
import { useSearch } from "../../context/SearchContext";
import UserName from "../UserName";
import CopyButton from "./CopyButton";
import HiddenResultsNotice from "./HiddenResultsNotice";
import { formatBytes, formatDate } from "./format";
import type { DisplayProps } from "./types";

interface TorrentRow {
  event: NostrEvent;
  title: string;
  infoHash?: string;
  magnet?: string;
  category?: string;
  tags: string[];
  files: TorrentFile[];
  size: number;
}

type SortKey = "title" | "size" | "files" | "date";

function toRow(event: NostrEvent): TorrentRow {
  const files = getTorrentFiles(event);
  return {
    event,
    title: getTorrentTitle(event) || "Untitled torrent",
    infoHash: getTorrentInfoHash(event),
    magnet: getTorrentMagnetLink(event),
    category: getTorrentCategoryPath(event),
    tags: getTorrentSearchTags(event),
    files,
    size: files.reduce((sum, f) => sum + (f.size ?? 0), 0),
  };
}

/** Full-width dashboard for NIP-35 torrent events */
export default function TorrentDashboard(props: DisplayProps) {
  const { appendToSearch } = useSearch();
  const [sortKey, setSortKey] = createSignal<SortKey>("date");
  const [ascending, setAscending] = createSignal(false);
  const [expanded, setExpanded] = createSignal<string | null>(null);

  const rows = createMemo(() =>
    props.events.filter((e) => e.kind === 2003).map(toRow),
  );
  const hidden = () => props.events.length - rows().length;

  const sorted = createMemo(() => {
    const dir = ascending() ? 1 : -1;
    const key = sortKey();
    return [...rows()].sort((a, b) => {
      switch (key) {
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "size":
          return (a.size - b.size) * dir;
        case "files":
          return (a.files.length - b.files.length) * dir;
        default:
          return (a.event.created_at - b.event.created_at) * dir;
      }
    });
  });

  const totalSize = () => rows().reduce((sum, r) => sum + r.size, 0);
  const totalFiles = () => rows().reduce((sum, r) => sum + r.files.length, 0);

  const topTags = createMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows())
      for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  });

  const sortBy = (key: SortKey) => {
    if (sortKey() === key) setAscending(!ascending());
    else {
      setSortKey(key);
      setAscending(key === "title");
    }
  };

  const header = (key: SortKey, label: string, cls = "") => (
    <th class={`cursor-pointer select-none ${cls}`} onClick={() => sortBy(key)}>
      {label}
      <Show when={sortKey() === key}>{ascending() ? " ▲" : " ▼"}</Show>
    </th>
  );

  return (
    <div class="space-y-4">
      {/* Stats */}
      <div class="stats stats-vertical sm:stats-horizontal shadow-sm bg-base-100 w-full">
        <div class="stat">
          <div class="stat-title">Torrents</div>
          <div class="stat-value text-2xl">{rows().length}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Total size</div>
          <div class="stat-value text-2xl">{formatBytes(totalSize())}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Files</div>
          <div class="stat-value text-2xl">{totalFiles()}</div>
        </div>
      </div>

      {/* Top tags */}
      <Show when={topTags().length > 0}>
        <div class="flex flex-wrap gap-1">
          <For each={topTags()}>
            {([tag, count]) => (
              <button
                class="badge badge-outline hover:badge-primary cursor-pointer"
                onClick={() => appendToSearch(`#${tag}`)}
                title={`Filter by #${tag}`}
              >
                #{tag} <span class="opacity-60 ml-1">{count}</span>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Table */}
      <div class="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table class="table table-sm">
          <thead>
            <tr>
              {header("title", "Name")}
              <th class="hidden md:table-cell">Category</th>
              {header("size", "Size", "text-right")}
              {header("files", "Files", "text-right hidden sm:table-cell")}
              <th class="hidden lg:table-cell">Uploader</th>
              {header("date", "Date", "hidden sm:table-cell")}
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={sorted()}>
              {(row) => (
                <>
                  <tr class="hover">
                    <td class="max-w-xs">
                      <button
                        class="text-left font-medium hover:link"
                        onClick={() =>
                          setExpanded(
                            expanded() === row.event.id ? null : row.event.id,
                          )
                        }
                        title="Show files"
                      >
                        {expanded() === row.event.id ? "▾ " : "▸ "}
                        {row.title}
                      </button>
                    </td>
                    <td class="hidden md:table-cell text-xs text-base-content/70">
                      {row.category ?? "—"}
                    </td>
                    <td class="text-right whitespace-nowrap font-mono text-xs">
                      {row.size ? formatBytes(row.size) : "—"}
                    </td>
                    <td class="text-right hidden sm:table-cell">
                      {row.files.length}
                    </td>
                    <td class="hidden lg:table-cell">
                      <UserName
                        pubkey={row.event.pubkey}
                        maxLength={16}
                        class="text-xs"
                      />
                    </td>
                    <td class="hidden sm:table-cell whitespace-nowrap text-xs text-base-content/70">
                      {formatDate(row.event.created_at)}
                    </td>
                    <td class="whitespace-nowrap text-right">
                      <Show when={row.magnet}>
                        <a
                          href={row.magnet}
                          class="btn btn-primary btn-xs"
                          title="Open magnet link"
                        >
                          🧲
                        </a>
                      </Show>
                      <Show when={row.infoHash}>
                        <CopyButton value={row.infoHash!} label="Hash" />
                      </Show>
                    </td>
                  </tr>
                  <Show when={expanded() === row.event.id}>
                    <tr>
                      <td colspan={7} class="bg-base-200">
                        <Show when={row.event.content}>
                          <p class="mb-2 whitespace-pre-wrap text-sm text-base-content/80">
                            {row.event.content}
                          </p>
                        </Show>
                        <Show when={row.infoHash}>
                          <p class="mb-2 font-mono text-xs break-all text-base-content/60">
                            {row.infoHash}
                          </p>
                        </Show>
                        <Show
                          when={row.files.length > 0}
                          fallback={
                            <p class="text-xs text-base-content/50">
                              No file list in this event.
                            </p>
                          }
                        >
                          <ul class="max-h-64 overflow-y-auto font-mono text-xs space-y-0.5">
                            <For each={row.files}>
                              {(file) => (
                                <li class="flex justify-between gap-4">
                                  <span class="break-all">{file.name}</span>
                                  <span class="whitespace-nowrap text-base-content/60">
                                    {file.size ? formatBytes(file.size) : ""}
                                  </span>
                                </li>
                              )}
                            </For>
                          </ul>
                        </Show>
                      </td>
                    </tr>
                  </Show>
                </>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <Show when={rows().length === 0}>
        <p class="text-center text-base-content/50">
          No torrents found in these results.
        </p>
      </Show>
      <HiddenResultsNotice count={hidden()} />
    </div>
  );
}
