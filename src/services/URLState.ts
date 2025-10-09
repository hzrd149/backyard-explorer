import { createSignal, createEffect, onCleanup } from "solid-js";

// URL state management utilities
export class URLStateManager {
  private static instance: URLStateManager;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    // Listen for browser navigation events
    window.addEventListener("popstate", this.handlePopState.bind(this));
  }

  static getInstance(): URLStateManager {
    if (!URLStateManager.instance) {
      URLStateManager.instance = new URLStateManager();
    }
    return URLStateManager.instance;
  }

  private handlePopState = () => {
    // Notify all listeners that URL has changed
    this.listeners.forEach((listener) => listener());
  };

  // Subscribe to URL changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get current search query from URL
  getSearchQuery(): string {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("q") || "";
  }

  // Set search query in URL
  setSearchQuery(query: string): void {
    const url = new URL(window.location.href);

    if (query.trim()) {
      url.searchParams.set("q", query.trim());
    } else {
      url.searchParams.delete("q");
    }

    // Update URL without triggering a page reload
    window.history.pushState({}, "", url.toString());

    // Notify listeners
    this.listeners.forEach((listener) => listener());
  }

  // Clear search query from URL
  clearSearchQuery(): void {
    this.setSearchQuery("");
  }
}

// Hook for managing search query state with URL synchronization
export function useSearchQuery() {
  const urlManager = URLStateManager.getInstance();
  const [query, setQuery] = createSignal(urlManager.getSearchQuery());

  // Subscribe to URL changes
  createEffect(() => {
    const unsubscribe = urlManager.subscribe(() => {
      setQuery(urlManager.getSearchQuery());
    });

    onCleanup(unsubscribe);
  });

  // Function to update both local state and URL
  const updateQuery = (newQuery: string) => {
    setQuery(newQuery);
    urlManager.setSearchQuery(newQuery);
  };

  // Function to clear both local state and URL
  const clearQuery = () => {
    setQuery("");
    urlManager.clearSearchQuery();
  };

  return {
    query,
    updateQuery,
    clearQuery,
  };
}
