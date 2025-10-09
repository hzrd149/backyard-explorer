import { createSignal, onMount, For, createEffect } from "solid-js";
import type { NostrEvent } from "nostr-tools";
import SearchBar from "./componnts/SearchBar";
import EventCard from "./componnts/events/EventCard";
import SearchWarning from "./componnts/SearchWarning";
import {
  isSearchSupported,
  requiresSearch,
  searchEvents,
  searchEventsWithSubscription,
} from "./services/SearchService";
import { useSearchQuery } from "./services/URLState";

function App() {
  const [events, setEvents] = createSignal<NostrEvent[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [searchSupported, setSearchSupported] = createSignal<boolean | null>(
    null,
  );
  const [error, setError] = createSignal<string | null>(null);

  // Use URL state as source of truth for search query
  const { query, updateQuery } = useSearchQuery();

  onMount(async () => {
    const supported = await isSearchSupported();
    setSearchSupported(supported);
  });

  // Automatically search when URL query changes
  createEffect(async () => {
    const currentQuery = query();
    if (currentQuery.trim()) {
      await performSearch(currentQuery);
    } else {
      setEvents([]);
      setError(null);
    }
  });

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setEvents([]);

    try {
      const subscription = await searchEvents(searchQuery, {
        event: (event: NostrEvent) => {
          setEvents((prev) => [...prev, event]);
        },
        error: (err: Error) => {
          setError(err.message);
          setIsLoading(false);
        },
        complete: () => {
          setIsLoading(false);
        },
      });

      // If search is not supported, try subscription as fallback
      if (!subscription && searchSupported() === false) {
        await searchEventsWithSubscription(searchQuery, {
          event: (event: NostrEvent) => {
            setEvents((prev) => [...prev, event]);
          },
          error: (err: Error) => {
            setError(err.message);
            setIsLoading(false);
          },
          complete: () => {
            setIsLoading(false);
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setIsLoading(false);
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

  return (
    <div class="min-h-screen bg-base-200">
      <div class="container mx-auto px-4 py-8">
        {!hasQuery() ? (
          // Show only search bar when no query
          <div class="flex flex-col items-center justify-center min-h-[60vh]">
            <div class="text-center mb-8">
              <h1 class="text-4xl font-bold text-base-content mb-4">
                Backyard Explorer
              </h1>
              <p class="text-base-content/70">
                Search all events in your local Nostr database. Filter by kind:{" "}
                <code class="bg-base-300 px-2 py-1 rounded">kind:1</code>,{" "}
                <code class="bg-base-300 px-2 py-1 rounded">k:3</code>, by
                author:{" "}
                <code class="bg-base-300 px-2 py-1 rounded">by:username</code>
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
                This is an example search app built using the{" "}
                <code class="bg-base-300 px-2 py-1 rounded text-sm">
                  window.nostrdb
                </code>{" "}
                API. The app's magic is powered by:
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
                    for vertex and primal integration for user lookup
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

            <div class="space-y-4 max-w-4xl mx-auto">
              <For each={events()}>
                {(event) => <EventCard event={event} />}
              </For>
            </div>

            {events().length === 0 &&
              !isLoading() &&
              searchSupported() !== null && (
                <div class="text-center text-base-content/50 mt-8">
                  <p>
                    No events found. Try searching for events, filter by kind
                    with{" "}
                    <code class="bg-base-300 px-2 py-1 rounded">kind:1</code>{" "}
                    for notes, or search by author with{" "}
                    <code class="bg-base-300 px-2 py-1 rounded">
                      by:username
                    </code>
                    .
                  </p>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
