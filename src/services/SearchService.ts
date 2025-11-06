import type { NostrEvent } from "nostr-tools";
import type { ProfilePointer } from "nostr-tools/nip19";
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

// Cache for lookup support status
let lookupSupported: boolean | null = null;

// Check if lookup is supported by the database
async function checkLookupSupport(): Promise<boolean> {
  if (lookupSupported !== null) {
    return lookupSupported;
  }

  try {
    const db = window.nostrdb;
    if (!db) {
      lookupSupported = false;
      return false;
    }

    const features = await db.supports();
    // @ts-ignore
    lookupSupported = features.includes("lookup");
    return lookupSupported;
  } catch (error) {
    console.error("Failed to check lookup support:", error);
    lookupSupported = false;
    return false;
  }
}

// Check if lookup is supported (cached)
export async function isLookupSupported(): Promise<boolean> {
  return await checkLookupSupport();
}

// Check if a query requires search functionality (has search text)
export function requiresSearch(query: string): boolean {
  const parsedQuery = parseQuery(query);
  return parsedQuery.searchText.trim().length > 0;
}

// Check if a query requires profile lookup functionality
export function requiresProfileLookup(query: string): boolean {
  const parsedQuery = parseQuery(query);
  return parsedQuery.profileLookup.length > 0;
}

// Search for events using the filters method with username resolution
export async function searchEvents(query: string): Promise<NostrEvent[]> {
  const db = window.nostrdb;
  const supported = await checkSearchSupport();
  const needsSearch = requiresSearch(query);

  if (!db) {
    throw new Error("NostrDB not available");
  }

  // Only require search support if the query actually needs search functionality
  if (needsSearch && !supported) {
    throw new Error("Search not supported");
  }

  try {
    // Parse the query to extract filters
    const parsedQuery = parseQuery(query);

    // Use the new function that resolves usernames
    const filters = await queryToFiltersWithResolution(parsedQuery);

    // Debug: Log the query and generated filters
    console.log(`Searching for: "${query}"`);
    console.log("Generated filters:", filters);

    // Use the filters functionality which returns a Promise of events
    const events = await db.filters(filters);

    return events || [];
  } catch (error) {
    console.error("Search failed:", error);
    throw error;
  }
}

// Search for profiles using the lookup method
export async function searchProfiles(query: string): Promise<ProfilePointer[]> {
  const db = window.nostrdb;

  if (!db) {
    throw new Error("NostrDB not available");
  }

  try {
    // Parse the query to extract profile lookup terms
    const parsedQuery = parseQuery(query);

    if (parsedQuery.profileLookup.length === 0) {
      throw new Error("No profile lookup terms found in query");
    }

    // Check if lookup is supported
    const features = await db.supports();
    if (!features.includes("lookup")) {
      throw new Error("Lookup feature not supported by database");
    }

    // Use the first profile lookup term (limit to 10 results)
    const searchTerm = parsedQuery.profileLookup[0];
    console.log(`Looking up profiles for: "${searchTerm}"`);

    const results = await db.lookup(searchTerm, 10);
    console.log(`Found ${results.length} profile results:`, results);

    return results;
  } catch (error) {
    console.error("Profile lookup failed:", error);
    throw error;
  }
}
