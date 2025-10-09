import type { StreamHandlers } from "../interface";
import { parseQuery, queryToFiltersWithResolution } from "./QueryParser";

// Cache for search support status
let searchSupported: boolean | null = null;

// Check if search is supported by the database
async function checkSearchSupport(): Promise<boolean> {
  if (searchSupported !== null) {
    return searchSupported;
  }

  try {
    const db = window.nostrdb;
    if (!db) {
      searchSupported = false;
      return false;
    }

    const features = await db.supports();
    // @ts-ignore
    searchSupported = features.includes("search");
    return searchSupported;
  } catch (error) {
    console.error("Failed to check search support:", error);
    searchSupported = false;
    return false;
  }
}

// Check if search is supported (cached)
export async function isSearchSupported(): Promise<boolean> {
  return await checkSearchSupport();
}

// Check if a query requires search functionality (has search text)
export function requiresSearch(query: string): boolean {
  const parsedQuery = parseQuery(query);
  return parsedQuery.searchText.trim().length > 0;
}

// Search for events using the filters method with username resolution
export async function searchEvents(query: string, handlers: StreamHandlers) {
  const db = window.nostrdb;
  const supported = await checkSearchSupport();
  const needsSearch = requiresSearch(query);

  if (!db) {
    handlers.error?.(new Error("NostrDB not available"));
    return null;
  }

  // Only require search support if the query actually needs search functionality
  if (needsSearch && !supported) {
    handlers.error?.(new Error("Search not supported"));
    return null;
  }

  try {
    // Parse the query to extract filters
    const parsedQuery = parseQuery(query);

    // Use the new function that resolves usernames
    const filters = await queryToFiltersWithResolution(parsedQuery);

    // Debug: Log the query and generated filters
    console.log(`Searching for: "${query}"`);
    console.log("Generated filters:", filters);

    // Use the filters functionality (works even without search support)
    return db.filters(filters, handlers);
  } catch (error) {
    console.error("Search failed:", error);
    handlers.error?.(error as Error);
    return null;
  }
}

// Search for events using the subscribe method as fallback with username resolution
export async function searchEventsWithSubscription(
  query: string,
  handlers: StreamHandlers,
) {
  const db = window.nostrdb;
  const supported = await checkSearchSupport();
  const needsSearch = requiresSearch(query);

  if (!db) {
    handlers.error?.(new Error("NostrDB not available"));
    return null;
  }

  // Only require search support if the query actually needs search functionality
  if (needsSearch && !supported) {
    handlers.error?.(new Error("Search not supported"));
    return null;
  }

  try {
    // Parse the query to extract filters
    const parsedQuery = parseQuery(query);

    // Use the new function that resolves usernames
    const filters = await queryToFiltersWithResolution(parsedQuery);

    // Use the subscribe functionality as fallback
    return db.subscribe(filters, handlers);
  } catch (error) {
    console.error("Search failed:", error);
    handlers.error?.(error as Error);
    return null;
  }
}
