import type { NostrEvent } from "nostr-tools";
import type { ProfilePointer } from "nostr-tools/nip19";
import { parseQuery, queryToFiltersWithResolution } from "./QueryParser";
import { getLookupProviders } from "./ConfigService";

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

// Check if lookup is supported (at least one provider is configured)
export async function isLookupSupported(): Promise<boolean> {
  return getLookupProviders().length > 0;
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

// Search for events using the query method with username resolution
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

    // Use the function that resolves usernames via lookup providers
    const filters = await queryToFiltersWithResolution(parsedQuery);

    // Debug: Log the query and generated filters
    console.log(`Searching for: "${query}"`);
    console.log("Generated filters:", filters);

    // Use the query functionality which returns a Promise of events
    const events = await db.query(filters);

    return events || [];
  } catch (error) {
    console.error("Search failed:", error);
    throw error;
  }
}

// Search for profiles using the configured lookup providers
export async function searchProfiles(query: string): Promise<ProfilePointer[]> {
  try {
    // Parse the query to extract profile lookup terms
    const parsedQuery = parseQuery(query);

    if (parsedQuery.profileLookup.length === 0) {
      throw new Error("No profile lookup terms found in query");
    }

    // Check if lookup is supported
    if (!(await isLookupSupported())) {
      throw new Error("No lookup providers are configured");
    }

    // Use the first profile lookup term
    const searchTerm = parsedQuery.profileLookup[0];
    console.log(`Looking up profiles for: "${searchTerm}"`);

    const { lookupProfiles } = await import("./LookupService");
    const results = await lookupProfiles(searchTerm, 10);
    console.log(`Found ${results.length} profile results:`, results);

    return results;
  } catch (error) {
    console.error("Profile lookup failed:", error);
    throw error;
  }
}
