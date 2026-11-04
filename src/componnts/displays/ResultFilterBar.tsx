import { For, Show } from "solid-js";
import {
  HIDE_REASON_LABELS,
  hasActiveRules,
  type FilterResult,
  type HideReason,
  type KindFacet,
  type ResultFilterSettings,
} from "../../services/ResultFilters";
import { useSearch } from "../../context/SearchContext";

interface ResultFilterBarProps {
  settings: ResultFilterSettings;
  onChange: (settings: ResultFilterSettings) => void;
  text: string;
  onText: (text: string) => void;
  result: FilterResult;
  facets: KindFacet[];
  /** Kinds the query already limits to; facets are offered unless it is just one */
  queryKinds: number[];
}

type Toggle = Exclude<
  {
    [K in keyof ResultFilterSettings]: ResultFilterSettings[K] extends boolean
      ? K
      : never;
  }[keyof ResultFilterSettings],
  "enabled"
>;

const TOGGLES: [Toggle, string][] = [
  ["hideReplies", "Hide replies"],
  ["hideReposts", "Hide reposts"],
  ["hideNsfw", "Hide sensitive content"],
  ["hideEncrypted", "Hide encrypted messages"],
  ["hideBridged", "Hide bridged accounts"],
];

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

/**
 * Text filter, hide rules and kind facets for the loaded results. Everything
 * here works on what is already loaded except the facets, which narrow the
 * search itself.
 */
export default function ResultFilterBar(props: ResultFilterBarProps) {
  const { appendToSearch } = useSearch();
  const set = (patch: Partial<ResultFilterSettings>) =>
    props.onChange({ ...props.settings, ...patch });
  const active = () => hasActiveRules(props.settings);

  const reasons = () =>
    (Object.entries(props.result.reasons) as [HideReason, number][])
      .filter(([, n]) => n > 0)
      .map(([reason, n]) => `${n} ${HIDE_REASON_LABELS[reason]}`)
      .join(", ");

  return (
    <div class="mb-4 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <label class="input input-sm input-bordered flex-1 min-w-48">
          <span class="opacity-50">⌕</span>
          <input
            type="search"
            placeholder="Filter loaded results"
            value={props.text}
            onInput={(e) => props.onText(e.currentTarget.value)}
          />
        </label>

        <div class="dropdown dropdown-end">
          <div
            tabindex="0"
            role="button"
            class="btn btn-sm"
            classList={{ "btn-primary": active() }}
          >
            Filters
            <Show when={active()}>
              <span class="badge badge-xs">on</span>
            </Show>
            <span class="opacity-60">▾</span>
          </div>
          <div
            tabindex="0"
            class="dropdown-content z-40 mt-1 w-72 rounded-box bg-base-100 p-3 shadow-lg border border-base-300 space-y-2 text-sm"
          >
            <label class="flex items-center justify-between gap-2 font-semibold">
              Apply filters
              <input
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
                checked={props.settings.enabled}
                onChange={(e) => set({ enabled: e.currentTarget.checked })}
              />
            </label>
            <div
              class="space-y-2"
              classList={{ "opacity-50": !props.settings.enabled }}
            >
              <For each={TOGGLES}>
                {([key, label]) => (
                  <label class="flex items-center justify-between gap-2">
                    {label}
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      checked={props.settings[key]}
                      onChange={(e) =>
                        set({
                          [key]: e.currentTarget.checked,
                        } as Partial<ResultFilterSettings>)
                      }
                    />
                  </label>
                )}
              </For>
              <label class="flex items-center justify-between gap-2">
                Max hashtags
                <input
                  type="number"
                  min="0"
                  placeholder="any"
                  class="input input-xs input-bordered w-16"
                  value={props.settings.maxHashtags || ""}
                  onInput={(e) =>
                    set({
                      maxHashtags: Math.max(
                        0,
                        e.currentTarget.valueAsNumber || 0,
                      ),
                    })
                  }
                />
              </label>
              <label class="flex items-center justify-between gap-2">
                Max mentions
                <input
                  type="number"
                  min="0"
                  placeholder="any"
                  class="input input-xs input-bordered w-16"
                  value={props.settings.maxMentions || ""}
                  onInput={(e) =>
                    set({
                      maxMentions: Math.max(
                        0,
                        e.currentTarget.valueAsNumber || 0,
                      ),
                    })
                  }
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <Show when={props.queryKinds.length !== 1 && props.facets.length > 1}>
        <div class="flex flex-wrap items-center gap-1 text-xs">
          <span class="text-base-content/50 mr-1">Loaded:</span>
          <For each={props.facets}>
            {(facet) => (
              <button
                class="badge badge-ghost badge-sm hover:badge-primary cursor-pointer"
                title={`Only search kind ${facet.kind}`}
                onClick={() => appendToSearch(`kind:${facet.kind}`)}
              >
                {facet.label} {compact(facet.count)}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.result.hidden > 0}>
        <div class="text-xs text-base-content/60">
          {props.result.hidden} hidden ({reasons()}) ·{" "}
          <button
            class="link link-primary"
            onClick={() => {
              props.onText("");
              set({ enabled: false });
            }}
          >
            show all
          </button>
          <Show when={props.text.trim()}>
            {" "}
            ·{" "}
            <button
              class="link link-primary"
              title="Text filters only see loaded results; a search asks the relay"
              onClick={() => {
                const text = props.text.trim();
                props.onText("");
                appendToSearch(
                  /^[^\s()"\\]+$/.test(text)
                    ? text
                    : `"${text.replace(/["\\]/g, "\\$&")}"`,
                );
              }}
            >
              search the relay for “{props.text.trim()}” instead
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
