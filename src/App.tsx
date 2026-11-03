import {
  createSignal,
  onMount,
  createEffect,
  createMemo,
  onCleanup,
  on,
  Show,
  untrack,
} from "solid-js";
import type { ProfilePointer } from "nostr-tools/nip19";
import SearchBar from "./componnts/SearchBar";
import ResultsDisplay from "./componnts/displays/ResultsDisplay";
import SearchWarning from "./componnts/SearchWarning";
import ProfileLookupResults from "./componnts/ProfileLookupResults";
import ConfigModal from "./componnts/ConfigModal";
import Lightbox from "./componnts/Lightbox";
import { SearchProvider } from "./context/SearchContext";
import {
  isSearchSupported,
  requiresSearch,
  requiresProfileLookup,
  searchFeed,
  searchProfiles,
} from "./services/SearchService";
import { useSearchQuery } from "./services/URLState";
import { stripViewTokens } from "./services/DisplayService";
import type { TimelineFeed } from "./services/TimelineFeed";

function App() {
  const [feed, setFeed] = createSignal<TimelineFeed | null>(null);
  const [profiles, setProfiles] = createSignal<ProfilePointer[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [searchSupported, setSearchSupported] = createSignal<boolean | null>(
    null,
  );
  const [error, setError] = createSignal<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = createSignal(false);

  // Use URL state as source of truth for search query
  const { query, updateQuery } = useSearchQuery();

  onMount(async () => {
    const supported = await isSearchSupported();
    setSearchSupported(supported);
  });

  // The query without `view:` tokens — switching display modes must not re-fetch
  const fetchQuery = createMemo(() => stripViewTokens(query()));

  // Stop the previous feed's loading whenever it is replaced. Read untracked so
  // that callers inside effects don't re-run whenever the feed changes
  const replaceFeed = (next: TimelineFeed | null) => {
    untrack(feed)?.close();
    setFeed(next);
  };
  onCleanup(() => untrack(feed)?.close());

  // Each search gets an id so a slow earlier search can't overwrite a newer one
  let searchId = 0;

  // Automatically search when the URL query changes. `on` limits tracking to
  // fetchQuery: performSearch reads and replaces the feed, and tracking that
  // would start a new search every time a search finished
  createEffect(
    on(fetchQuery, (currentQuery) => {
      if (currentQuery.trim()) {
        performSearch(currentQuery);
      } else {
        searchId++;
        replaceFeed(null);
        setProfiles([]);
        setError(null);
        setIsLoading(false);
      }
    }),
  );

  const performSearch = async (searchQuery: string) => {
    const id = ++searchId;
    setIsLoading(true);
    setError(null);
    replaceFeed(null);
    setProfiles([]);

    try {
      // Check if this is a profile lookup query
      if (requiresProfileLookup(searchQuery)) {
        console.log("Performing profile lookup for:", searchQuery);
        const profileResults = await searchProfiles(searchQuery);
        if (id === searchId) setProfiles(profileResults);
        return;
      }

      // Regular event search: the feed loads pages as the results are scrolled
      const next = await searchFeed(searchQuery);
      if (id === searchId) replaceFeed(next);
      else next.close();
    } catch (err) {
      if (id === searchId)
        setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      if (id === searchId) setIsLoading(false);
    }
  };

  // Handle search from SearchBar - updates URL which triggers the effect above
  const handleSearch = (searchQuery: string) => {
    updateQuery(searchQuery);
  };

  const hasQuery = () => query().trim().length > 0;
  const shouldShowWarning = () => {
    const currentQuery = query();
    return searchSupported() === false && requiresSearch(currentQuery);
  };

  const noResults = () => (
    <div class="text-center text-base-content/50 mt-8">
      <p>
        No results found. Try searching for events, filter by kind with{" "}
        <code class="bg-base-300 px-2 py-1 rounded">kind:1</code> for notes,{" "}
        <code class="bg-base-300 px-2 py-1 rounded">kind:20</code> for picture
        posts, search by author with{" "}
        <code class="bg-base-300 px-2 py-1 rounded">by:username</code>, filter
        by date with{" "}
        <code class="bg-base-300 px-2 py-1 rounded">since:yesterday</code> or{" "}
        <code class="bg-base-300 px-2 py-1 rounded">after:2024-01-01</code>, or
        lookup profiles with{" "}
        <code class="bg-base-300 px-2 py-1 rounded">p:username</code>.
      </p>
    </div>
  );

  return (
    <SearchProvider updateSearch={handleSearch}>
      <div class="min-h-screen bg-base-200">
        {/* Settings Button - Fixed Position */}
        <div class="fixed top-4 right-4 z-50">
          <button
            class="btn btn-circle btn-ghost"
            onClick={() => setIsConfigModalOpen(true)}
            title="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* Config Modal */}
        <ConfigModal
          isOpen={isConfigModalOpen()}
          onClose={() => setIsConfigModalOpen(false)}
        />

        <div class="container mx-auto px-4 py-8">
          {!hasQuery() ? (
            // Show only search bar when no query
            <div class="flex flex-col items-center justify-center min-h-[60vh]">
              <div class="text-center mb-8">
                <h1 class="text-4xl font-bold text-base-content mb-4">
                  Backyard Explorer
                </h1>
                <p class="text-base-content/70">
                  Search all events in your local Nostr database. Filter by
                  kind:{" "}
                  <code class="bg-base-300 px-2 py-1 rounded">kind:1</code>,{" "}
                  <code class="bg-base-300 px-2 py-1 rounded">k:20</code>{" "}
                  (picture posts), by author:{" "}
                  <code class="bg-base-300 px-2 py-1 rounded">by:username</code>
                  , by date:{" "}
                  <code class="bg-base-300 px-2 py-1 rounded">
                    since:yesterday
                  </code>
                  ,{" "}
                  <code class="bg-base-300 px-2 py-1 rounded">
                    until:"last week"
                  </code>
                  , lookup profiles:{" "}
                  <code class="bg-base-300 px-2 py-1 rounded">p:username</code>,
                  or change how results are shown:{" "}
                  <code class="bg-base-300 px-2 py-1 rounded">view:images</code>
                </p>
              </div>

              {shouldShowWarning() && (
                <div class="mb-6">
                  <SearchWarning />
                </div>
              )}

              <div class="w-full max-w-2xl">
                <SearchBar onSearch={handleSearch} value={query()} />
              </div>

              <div class="mt-8 max-w-3xl mx-auto bg-base-100 rounded-lg p-6 shadow-sm">
                <p class="text-base-content/80 mb-4">
                  This is an example search app built with{" "}
                  <a
                    href="https://hzrd149.github.io/applesauce/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary hover:underline font-semibold"
                  >
                    Applesauce
                  </a>{" "}
                  using the{" "}
                  <code class="bg-base-300 px-2 py-1 rounded text-sm">
                    window.nostrdb
                  </code>{" "}
                  API. The source code is available on{" "}
                  <a
                    href="https://github.com/hzrd149/backyard-explorer"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary hover:underline font-semibold"
                  >
                    GitHub
                  </a>
                  . The app's magic is powered by:
                </p>
                <ul class="space-y-2 text-sm text-base-content/70">
                  <li class="flex items-start">
                    <span class="text-primary mr-2">•</span>
                    <span>
                      <strong>Polyfill</strong> to ensure{" "}
                      <code class="bg-base-300 px-1 py-0.5 rounded text-xs">
                        window.nostrdb
                      </code>{" "}
                      always exists and uses the nostr relay tray{" "}
                      <a
                        href="https://github.com/hzrd149/window.nostrdb.js"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline"
                      >
                        github.com/hzrd149/window.nostrdb.js
                      </a>
                    </span>
                  </li>
                  <li class="flex items-start">
                    <span class="text-primary mr-2">•</span>
                    <span>
                      <strong>Nostr relay tray</strong>{" "}
                      <a
                        href="https://github.com/CodyTseng/nostr-relay-tray"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline"
                      >
                        github.com/CodyTseng/nostr-relay-tray
                      </a>{" "}
                      for a local relay that supports search
                    </span>
                  </li>
                  <li class="flex items-start">
                    <span class="text-primary mr-2">•</span>
                    <span>
                      <strong>Applesauce extra</strong>{" "}
                      <a
                        href="https://github.com/hzrd149/applesauce/tree/master/packages/extra"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline"
                      >
                        github.com/hzrd149/applesauce/tree/master/packages/extra
                      </a>{" "}
                      for event parsing helpers and user search
                    </span>
                  </li>
                  <li class="flex items-start">
                    <span class="text-primary mr-2">•</span>
                    <span>
                      <strong>User search</strong> powered by{" "}
                      <a
                        href="https://primal.net"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline"
                      >
                        Primal
                      </a>
                      ,{" "}
                      <a
                        href="https://github.com/Open-Ranking/protocol"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline"
                      >
                        Open Ranking
                      </a>
                      , and{" "}
                      <a
                        href="https://contextvm.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline"
                      >
                        Relatr (ContextVM)
                      </a>
                    </span>
                  </li>
                  <li class="flex items-start">
                    <span class="text-primary mr-2">•</span>
                    <span>
                      <strong>Browser extension</strong> for injecting the{" "}
                      <code class="bg-base-300 px-1 py-0.5 rounded text-xs">
                        window.nostrdb
                      </code>{" "}
                      API{" "}
                      <a
                        href="https://github.com/hzrd149/nostr-bucket"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline"
                      >
                        github.com/hzrd149/nostr-bucket
                      </a>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            // Show search results when there's a query
            <>
              {shouldShowWarning() && (
                <div class="mb-6">
                  <SearchWarning />
                </div>
              )}

              <div class="mb-8">
                <SearchBar onSearch={handleSearch} value={query()} />
              </div>

              {isLoading() && (
                <div class="flex justify-center mb-6">
                  <span class="loading loading-spinner loading-lg"></span>
                </div>
              )}

              {error() && (
                <div class="alert alert-error mb-6">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="stroke-current shrink-0 h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{error()}</span>
                </div>
              )}

              {/* Show profile lookup results if we have any */}
              {profiles().length > 0 && (
                <div class="mb-8">
                  <ProfileLookupResults
                    profiles={profiles()}
                    isLoading={isLoading()}
                    error={error()}
                  />
                </div>
              )}

              {/* Event results, loaded page by page as they are scrolled */}
              <Show when={feed()} keyed>
                {(current) => (
                  <ResultsDisplay
                    feed={current}
                    query={query()}
                    empty={noResults()}
                  />
                )}
              </Show>

              {/* Show no results message if a lookup found nothing */}
              {profiles().length === 0 &&
                !feed() &&
                !isLoading() &&
                !error() &&
                searchSupported() !== null &&
                noResults()}
            </>
          )}
        </div>
      </div>
      <Lightbox />
    </SearchProvider>
  );
}

export default App;
