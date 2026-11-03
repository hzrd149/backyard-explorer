import {
  createSignal,
  createEffect,
  createMemo,
  For,
  on,
  onMount,
  onCleanup,
  Show,
} from "solid-js";
import { npubEncode } from "nostr-tools/nip19";
import { searchExamples } from "../examples";
import {
  isSearchSupported,
  isLookupSupported,
} from "../services/SearchService";
import {
  decodePubkey,
  planQuery,
  QueryError,
  type QueryPlan,
} from "../services/QueryPlanner";
import {
  applySuggestion,
  describePlan,
  nakCommands,
  suggest,
  tokenAtCursor,
  type CursorToken,
} from "../services/QueryAssist";
import {
  addToHistory,
  getHistory,
  removeFromHistory,
} from "../services/QueryHistory";
import { DEFAULT_LOCAL_RELAYS, getConfig } from "../services/ConfigService";
import { fetchProfile, getDisplayName } from "../services/ProfileService";
import UserAvatar from "./UserAvatar";

interface SearchBarProps {
  onSearch: (query: string) => void;
  value?: string;
}

/** Fields whose value is a person, completed by looking up names */
const PERSON_FIELDS = ["by", "from", "author", "mentions"];
const PERSON_DEBOUNCE = 300;

interface MenuItem {
  key: string;
  label: string;
  detail?: string;
  /** Avatar for person results */
  pubkey?: string;
  /** Replaces the token under the cursor */
  insert?: string;
  /** Runs this query from history */
  history?: string;
}

type Feedback =
  | { kind: "plan"; plan: QueryPlan; lines: string[] }
  | { kind: "error"; error: QueryError };

export default function SearchBar(props: SearchBarProps) {
  const [query, setQuery] = createSignal(props.value || "");
  const [currentExampleIndex, setCurrentExampleIndex] = createSignal(0);
  const [currentDisplayedExample, setCurrentDisplayedExample] =
    createSignal("");
  const [placeholder, setPlaceholder] = createSignal("");
  const [shuffledExamples, setShuffledExamples] = createSignal<string[]>([]);
  const [searchSupported, setSearchSupported] = createSignal<boolean | null>(
    null,
  );
  const [lookupSupported, setLookupSupported] = createSignal<boolean | null>(
    null,
  );

  // Editor state
  const [cursor, setCursor] = createSignal(0);
  const [focused, setFocused] = createSignal(false);
  const [dismissed, setDismissed] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  const [history, setHistory] = createSignal(getHistory());
  const [people, setPeople] = createSignal<MenuItem[]>([]);
  const [copied, setCopied] = createSignal(false);
  let input: HTMLInputElement | undefined;
  let intervalId: number | undefined;

  // Fisher-Yates shuffle algorithm
  const shuffleArray = (array: string[]): string[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Sync with external value prop (from URL)
  createEffect(() => {
    if (props.value !== undefined) {
      setQuery(props.value);
    }
  });

  // Check support status on mount
  onMount(async () => {
    // Check search and lookup support
    try {
      const searchSupport = await isSearchSupported();
      const lookupSupport = await isLookupSupported();
      setSearchSupported(searchSupport);
      setLookupSupported(lookupSupport);
    } catch (error) {
      console.error("Failed to check support status:", error);
      setSearchSupported(false);
      setLookupSupported(false);
    }

    // Initialize shuffled examples
    const shuffled = shuffleArray([...searchExamples]);
    setShuffledExamples(shuffled);

    const updatePlaceholder = () => {
      const examples = shuffledExamples();
      if (examples.length === 0) return;

      const currentIndex = currentExampleIndex();
      const exampleToShow = examples[currentIndex];
      setCurrentDisplayedExample(exampleToShow);
      setPlaceholder(exampleToShow);

      // Move to next example, reshuffle when we reach the end
      const nextIndex = currentIndex + 1;
      if (nextIndex >= examples.length) {
        // Reshuffle for next cycle
        const newShuffled = shuffleArray([...searchExamples]);
        setShuffledExamples(newShuffled);
        setCurrentExampleIndex(0);
      } else {
        setCurrentExampleIndex(nextIndex);
      }
    };

    // Set initial placeholder
    updatePlaceholder();

    // Rotate every 3 seconds
    intervalId = setInterval(updatePlaceholder, 3000);
  });

  // "/" focuses the search box from anywhere on the page
  const onGlobalKey = (e: KeyboardEvent) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    )
      return;
    e.preventDefault();
    input?.focus();
    input?.select();
  };
  window.addEventListener("keydown", onGlobalKey);

  onCleanup(() => {
    window.removeEventListener("keydown", onGlobalKey);
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  // --- Query feedback -------------------------------------------------------

  const feedback = createMemo((): Feedback | undefined => {
    const q = query();
    if (!q.trim()) return undefined;
    try {
      const plan = planQuery(q);
      return { kind: "plan", plan, lines: describePlan(plan) };
    } catch (error) {
      if (error instanceof QueryError) return { kind: "error", error };
      return undefined;
    }
  });

  const copyNak = async (plan: QueryPlan) => {
    const relay = getConfig().localRelays?.[0] ?? DEFAULT_LOCAL_RELAYS[0];
    const filters = plan.branches.map((b) => b.filter);
    try {
      await navigator.clipboard.writeText(nakCommands(filters, relay));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // --- Completions ----------------------------------------------------------

  const token = createMemo(() => tokenAtCursor(query(), cursor()));

  // A by:/mentions: value worth looking up, kept stable while the token is unchanged
  const personToken = createMemo(
    (): { token: CursorToken; name: string } | undefined => {
      const t = token();
      if (!t?.field || !PERSON_FIELDS.includes(t.field)) return undefined;
      const name = t.value ?? "";
      if (name.length < 2 || name.includes(",") || decodePubkey(name)) {
        return undefined;
      }
      return { token: t, name };
    },
    undefined,
    {
      equals: (a, b) =>
        a?.token.text === b?.token.text && a?.token.start === b?.token.start,
    },
  );

  createEffect(
    on(personToken, (target) => {
      setPeople([]);
      if (!target || !lookupSupported()) return;

      const timer = setTimeout(async () => {
        try {
          const { lookupProfiles } = await import("../services/LookupService");
          const results = await lookupProfiles(target.name, 6);
          const items = await Promise.all(
            results.map(async ({ pubkey }): Promise<MenuItem> => {
              const npub = npubEncode(pubkey);
              const profile = await fetchProfile(pubkey).catch(() => null);
              return {
                key: `person:${pubkey}`,
                label: getDisplayName(profile ?? undefined, npub) ?? npub,
                detail: `${npub.slice(0, 12)}…`,
                pubkey,
                insert: `${target.token.field}:${npub}`,
              };
            }),
          );
          // Drop results for a token the user has already moved past
          if (personToken() === target) setPeople(items);
        } catch {
          // No provider found anyone; leave the list empty
        }
      }, PERSON_DEBOUNCE);
      onCleanup(() => clearTimeout(timer));
    }),
  );

  const items = createMemo((): MenuItem[] => {
    if (!focused() || dismissed()) return [];

    if (!query().trim()) {
      return history().map((q) => ({
        key: `history:${q}`,
        label: q,
        history: q,
      }));
    }

    const fields =
      suggest(query(), cursor())?.suggestions.map((s) => ({
        key: `suggest:${s.insert}`,
        label: s.label,
        detail: s.detail,
        insert: s.insert,
      })) ?? [];
    return [...people(), ...fields];
  });

  // Reset the highlight whenever the list changes
  createEffect(on(items, () => setActive(-1)));

  const open = () => items().length > 0;

  const syncCursor = () => setCursor(input?.selectionStart ?? query().length);

  const accept = (item: MenuItem) => {
    if (item.history !== undefined) {
      setQuery(item.history);
      submit(item.history);
      return;
    }
    const t = token();
    if (!t || item.insert === undefined) return;
    const next = applySuggestion(query(), t, item.insert);
    setQuery(next.query);
    setCursor(next.cursor);
    setPeople([]);
    // Place the caret after the inserted text once the input has updated
    queueMicrotask(() => {
      input?.focus();
      input?.setSelectionRange(next.cursor, next.cursor);
    });
  };

  const submit = (value: string) => {
    const searchQuery = value.trim();
    if (searchQuery) setHistory(addToHistory(searchQuery));
    setDismissed(true);
    // Allow empty search to clear results
    props.onSearch(searchQuery);
  };

  const forget = (e: MouseEvent, q: string) => {
    e.preventDefault();
    e.stopPropagation();
    setHistory(removeFromHistory(q));
  };

  // --- Input handlers -------------------------------------------------------

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    submit(query());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const list = items();

    if (e.key === "ArrowDown" && list.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % list.length);
    } else if (e.key === "ArrowUp" && list.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? list.length - 1 : i - 1));
    } else if (e.key === "Tab" && !e.shiftKey && list.length) {
      // Tab completes the highlighted item, or the first completion
      const item = list[Math.max(active(), 0)];
      if (item.history === undefined) {
        e.preventDefault();
        accept(item);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter only takes a completion the user highlighted, otherwise it searches
      const item = list[active()];
      if (item) accept(item);
      else submit(query());
    } else if (e.key === "Escape" && open()) {
      e.preventDefault();
      setDismissed(true);
    }
  };

  const handleSearchClick = () => {
    const searchQuery = query().trim();
    if (searchQuery) {
      // Use current input value
      submit(searchQuery);
    } else {
      // Use currently displayed example if input is empty
      const exampleToUse = currentDisplayedExample();
      if (exampleToUse) {
        setQuery(exampleToUse);
        submit(exampleToUse);
      }
    }
  };

  return (
    <div class="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <div class="relative">
          <div class="join w-full">
            <input
              ref={input}
              type="search"
              placeholder={placeholder()}
              value={query()}
              onInput={(e) => {
                setQuery(e.currentTarget.value);
                setDismissed(false);
                syncCursor();
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={syncCursor}
              onClick={syncCursor}
              onFocus={() => {
                setFocused(true);
                setDismissed(false);
                syncCursor();
              }}
              onBlur={() => setFocused(false)}
              autocomplete="off"
              spellcheck={false}
              role="combobox"
              aria-expanded={open()}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
              class="input join-item input-bordered flex-1 text-lg input-lg"
            />
            <button
              type="button"
              onClick={handleSearchClick}
              class="btn join-item btn-primary btn-lg"
              title="Search"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>

          {/* Completions and history */}
          <Show when={open()}>
            <ul
              id="search-suggestions"
              role="listbox"
              class="absolute left-0 right-0 top-full mt-1 z-30 menu menu-sm bg-base-100 rounded-box shadow-lg border border-base-300 max-h-80 overflow-y-auto flex-nowrap"
            >
              <Show when={!query().trim()}>
                <li class="menu-title">Recent searches</li>
              </Show>
              <For each={items()}>
                {(item, index) => (
                  <li role="option" aria-selected={active() === index()}>
                    <a
                      class={`flex items-center gap-2 ${active() === index() ? "menu-active" : ""}`}
                      // Keep focus in the input so the list doesn't close first
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(index())}
                      onClick={() => accept(item)}
                    >
                      <Show when={item.pubkey}>
                        {(pubkey) => <UserAvatar pubkey={pubkey()} size="xs" />}
                      </Show>
                      <span class="font-mono truncate">{item.label}</span>
                      <Show when={item.detail}>
                        <span class="ml-auto text-xs text-base-content/50 truncate">
                          {item.detail}
                        </span>
                      </Show>
                      <Show when={item.history !== undefined}>
                        <button
                          type="button"
                          class="ml-auto btn btn-ghost btn-xs"
                          title="Remove from history"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => forget(e, item.history!)}
                        >
                          ✕
                        </button>
                      </Show>
                    </a>
                  </li>
                )}
              </For>
              <Show when={query().trim()}>
                <li class="menu-title text-xs font-normal">
                  Tab to complete · ↑↓ to choose · Esc to close
                </li>
              </Show>
            </ul>
          </Show>
        </div>
      </form>

      {/* What the query will fetch, or why it can't be run */}
      <Show when={feedback()} keyed>
        {(current) => {
          if (current.kind === "error") {
            const { error } = current;
            const q = query();
            const at = Math.min(error.position ?? q.length, q.length);
            const len = Math.max(1, error.length ?? 1);
            return (
              <div class="mt-2 text-sm text-warning" role="status">
                <div>{error.message}</div>
                <Show when={error.position !== undefined}>
                  <div class="font-mono text-xs whitespace-pre overflow-x-auto text-base-content/70">
                    {q.slice(0, at)}
                    <span class="underline decoration-wavy decoration-warning text-warning">
                      {q.slice(at, at + len) || " "}
                    </span>
                    {q.slice(at + len)}
                  </div>
                </Show>
              </div>
            );
          }

          const { plan, lines } = current;
          return (
            <div class="mt-2 flex items-start gap-2 text-xs text-base-content/60">
              <div class="flex-1 min-w-0">
                <For each={lines}>
                  {(line, index) => (
                    <div class="truncate" title={line}>
                      <Show when={index() > 0}>
                        <span class="font-semibold text-base-content/40">
                          OR{" "}
                        </span>
                      </Show>
                      {line}
                    </div>
                  )}
                </For>
              </div>
              <Show when={plan.branches.length > 0}>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs font-mono"
                  title="Copy as nak req commands"
                  onClick={() => copyNak(plan)}
                >
                  {copied() ? "copied" : "nak"}
                </button>
              </Show>
            </div>
          );
        }}
      </Show>

      {/* Support badges */}
      <div class="flex gap-2 mt-2">
        <div
          class={`badge badge-soft badge-sm ${searchSupported() ? "badge-success" : "badge-error"}`}
        >
          {searchSupported() === null ? "⏳" : searchSupported() ? "✓" : "✗"}{" "}
          Search
        </div>
        <div
          class={`badge badge-soft badge-sm ${lookupSupported() ? "badge-success" : "badge-error"}`}
        >
          {lookupSupported() === null ? "⏳" : lookupSupported() ? "✓" : "✗"}{" "}
          Lookup
        </div>
      </div>
    </div>
  );
}
