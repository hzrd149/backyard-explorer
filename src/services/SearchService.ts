import type { ProfilePointer } from "nostr-tools/nip19";
import { planQuery, resolvePlan, tryPlanQuery } from "./QueryPlanner";
import { getLookupProviders } from "./ConfigService";
import { createTimelineFeed, type TimelineFeed } from "./TimelineFeed";

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
  return tryPlanQuery(query)?.needsSearch ?? false;
}

// Check if a query requires profile lookup functionality
export function requiresProfileLookup(query: string): boolean {
  return (tryPlanQuery(query)?.profileLookup.length ?? 0) > 0;
}

// Best matching pubkey for a by:/mentions: name from the configured lookup providers
async function lookupPubkey(name: string): Promise<string | undefined> {
  const { lookupProfiles } = await import("./LookupService");
  const results = await lookupProfiles(name);
  return results[0]?.pubkey;
}

// Create an infinitely scrolling feed of events for a query, resolving usernames first
export async function searchFeed(query: string): Promise<TimelineFeed> {
  const db = window.nostrdb;

  if (!db) {
    throw new Error("NostrDB not available");
  }

  // Parse the query into one filter per OR branch; throws a QueryError on bad syntax
  const plan = planQuery(query);

  // Only require search support if the query actually needs search functionality
  if (plan.needsSearch && !(await checkSearchSupport())) {
    throw new Error("Search not supported");
  }

  // Resolve by:/mentions: names via the lookup providers
  const filters = await resolvePlan(plan, lookupPubkey);

  // Debug: Log the query and generated filters
  console.log(`Searching for: "${query}"`);
  console.log("Generated filters:", filters);

  return createTimelineFeed(filters, { cap: plan.limit });
}

// Search for profiles using the configured lookup providers
export async function searchProfiles(query: string): Promise<ProfilePointer[]> {
  try {
    // Parse the query to extract profile lookup terms
    const { profileLookup } = planQuery(query);

    if (profileLookup.length === 0) {
      throw new Error("No profile lookup terms found in query");
    }

    // Check if lookup is supported
    if (!(await isLookupSupported())) {
      throw new Error("No lookup providers are configured");
    }

    // Look up every term, e.g. p:(alice OR bob), and merge the results
    const { lookupProfiles } = await import("./LookupService");
    const lists = await Promise.all(
      profileLookup.map((term) => lookupProfiles(term, 10)),
    );

    const seen = new Set<string>();
    const results = lists.flat().filter((profile) => {
      if (seen.has(profile.pubkey)) return false;
      seen.add(profile.pubkey);
      return true;
    });
    console.log(`Found ${results.length} profile results:`, results);

    return results;
  } catch (error) {
    console.error("Profile lookup failed:", error);
    throw error;
  }
}
