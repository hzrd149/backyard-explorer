import type { Filter } from "nostr-tools";

export interface ParsedQuery {
  searchText: string;
  kinds: number[];
  authors: string[];
  tags: Record<string, string[]>;
  profiles: string[];
  usernames: string[]; // New field for usernames that need to be resolved
  hashtags: string[]; // New field for hashtags
  profileLookup: string[]; // New field for p:<name> profile lookups
  since?: number;
  until?: number;
  limit?: number;
}

// Mapping of common event kind names to their numbers
const EVENT_KIND_MAP: Record<string, number> = {
  // Basic kinds
  note: 1,
  article: 30023,
  profile: 0,
  contacts: 3,

  // Common event kinds from NIPs
  metadata: 0,
  text: 1,
  recommend_relay: 2,
  follow: 3,
  follows: 3,
  encrypted_dm: 4,
  deletion: 5,
  delete: 5,
  repost: 6,
  reaction: 7,
  badge_award: 8,
  chat_message: 9,
  group_chat_reply: 10,
  thread: 11,
  group_thread_reply: 12,
  seal: 13,
  direct_message: 14,
  file_message: 15,
  generic_repost: 16,
  website_reaction: 17,
  picture: 20,
  video: 21,
  short_video: 22,

  // Other common kinds
  request_vanish: 62,
  chess: 64,
  poll_response: 1018,
  bid: 1021,
  bid_confirmation: 1022,
  opentimestamp: 1040,
  gift_wrap: 1059,
  file: 1063,
  poll: 1068,
  comment: 1111,
  voice_message: 1222,
  voice_comment: 1244,
  live_chat: 1311,
  code: 1337,
  snippet: 1337,
  patch: 1617,
  issue: 1618,
  git_reply: 1622,
  status: 1630,
  problem_tracker: 1971,
  report: 1984,
  label: 1985,
  relay_review: 1986,
  ai_embeddings: 1987,
  torrent: 2003,
  torrent_comment: 2004,
  coinjoin_pool: 2022,
  cashu_reserved: 7374,
  cashu_tokens: 7375,
  cashu_history: 7376,
  geocache_log: 7516,
  geocache_proof: 7517,
  group_control: 9000,
  goal: 9041,
  nutzap: 9321,
  tidal_login: 9467,
  zap_request: 9734,
  zap: 9735,
  highlight: 9802,

  // List kinds
  mutes: 10000,
  mute: 10000,
  pins: 10001,
  pin: 10001,
  relays: 10002,
  bookmarks: 10003,
  communities: 10004,
  public_chats: 10005,
  blocked_relays: 10006,
  search_relays: 10007,
  user_groups: 10009,
  favorite_relays: 10012,
  interests: 10015,
  nutzap_mint_recommendation: 10019,
  media_follows: 10020,
  user_emojis: 10030,
  dm_relays: 10050,
  keypackage_relays: 10051,
  user_server_list: 10063,
  relay_monitor: 10166,
  room_presence: 10312,
  proxy_announcement: 10377,
  transport_method: 11111,
  wallet_info: 13194,
  cashu_wallet: 17375,

  // Set kinds
  follow_set: 30000,
  generic_list: 30001,
  relay_set: 30002,
  bookmark_set: 30003,
  curation_set: 30004,
  video_set: 30005,
  kind_mute_set: 30007,
  profile_badge: 30008,
  badge_definition: 30009,
  interest_set: 30015,
  stall: 30017,
  product: 30018,
  marketplace: 30019,
  auction: 30020,
  longform: 30023,
  emoji: 30030,
  curated_publication_index: 30040,
  curated_publication_content: 30041,
  release_artifact_set: 30063,
  app_data: 30078,
  relay_discovery: 30166,
  app_curation_set: 30267,
  live_event: 30311,
  interactive_room: 30312,
  conference_event: 30313,
  user_status: 30315,
  slide_set: 30388,
  classified_listing: 30402,
  draft_classified_listing: 30403,
  repository_announcement: 30617,
  repository_state: 30618,
  wiki_article: 30818,
  redirect: 30819,
  draft_event: 31234,
  link_set: 31388,
  feed: 31890,
  date_calendar_event: 31922,
  time_calendar_event: 31923,
  calendar: 31924,
  calendar_rsvp: 31925,
  handler_recommendation: 31989,
  handler_information: 31990,
  software_application: 32267,
  community_definition: 34550,
  cashu_mint: 38172,
  fedimint: 38173,
  geocache_listing: 37516,
  p2p_order: 38383,
  group_metadata: 39000,
  starter_pack: 39089,
  media_starter_pack: 39092,
  web_bookmark: 39701,
};

// Helper function to tokenize query string
function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < query.length; i++) {
    const char = query[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = "";
    } else if (char === " " && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

// Parse a query string into a structured query object
export function parseQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    searchText: "",
    kinds: [],
    authors: [],
    tags: {},
    profiles: [],
    usernames: [],
    hashtags: [],
    profileLookup: [],
  };

  // Split query into parts, handling quoted strings
  const parts = tokenize(query);

  for (const part of parts) {
    if (part.startsWith("kind:") || part.startsWith("k:")) {
      const kindStr = part.split(":")[1];
      const kind = parseInt(kindStr, 10);
      if (!isNaN(kind)) {
        result.kinds.push(kind);
      }
    } else if (part.startsWith("is:")) {
      const typeStr = part.split(":")[1];
      if (typeStr && typeStr in EVENT_KIND_MAP) {
        result.kinds.push(EVENT_KIND_MAP[typeStr]);
      }
    } else if (part.startsWith("by:")) {
      const username = part.split(":")[1];
      if (username) {
        result.usernames.push(username);
      }
    } else if (part.startsWith("p:")) {
      const profileName = part.split(":")[1];
      if (profileName) {
        result.profileLookup.push(profileName);
      }
    } else if (part.startsWith("author:") || part.startsWith("a:")) {
      const author = part.split(":")[1];
      if (author) {
        result.authors.push(author);
      }
    } else if (part.startsWith("tag:") || part.startsWith("t:")) {
      const tagPart = part.split(":")[1];
      if (tagPart) {
        const [tagName, tagValue] = tagPart.split("=");
        if (tagName && tagValue) {
          if (!result.tags[tagName]) {
            result.tags[tagName] = [];
          }
          result.tags[tagName].push(tagValue);
        }
      }
    } else if (part.startsWith("since:")) {
      const sinceStr = part.split(":")[1];
      const since = parseInt(sinceStr, 10);
      if (!isNaN(since)) {
        result.since = since;
      }
    } else if (part.startsWith("until:")) {
      const untilStr = part.split(":")[1];
      const until = parseInt(untilStr, 10);
      if (!isNaN(until)) {
        result.until = until;
      }
    } else if (part.startsWith("limit:")) {
      const limitStr = part.split(":")[1];
      const limit = parseInt(limitStr, 10);
      if (!isNaN(limit)) {
        result.limit = limit;
      }
    } else if (part.startsWith("#")) {
      // Hashtag detection - extract hashtag and convert to lowercase
      const hashtag = part.substring(1); // Remove the # symbol
      if (hashtag && hashtag.trim()) {
        result.hashtags.push(hashtag.toLowerCase().trim());
      }
    } else {
      // Regular search text
      result.searchText += (result.searchText ? " " : "") + part;
    }
  }

  return result;
}

// Resolve usernames to pubkeys using the lookup method
export async function resolveUsernames(usernames: string[]): Promise<string[]> {
  if (usernames.length === 0) {
    return [];
  }

  try {
    const db = window.nostrdb;
    if (!db) {
      throw new Error("NostrDB not available for username resolution");
    }

    // Check if lookup is supported
    const features = await db.supports();
    if (!features.includes("lookup")) {
      throw new Error("Lookup feature not supported by database");
    }

    const resolvedPubkeys: string[] = [];

    // Resolve each username
    for (const username of usernames) {
      try {
        const results = await db.lookup(username);
        if (results && results.length > 0) {
          // Take the first (best match) result
          resolvedPubkeys.push(results[0].pubkey);
        } else {
          throw new Error(`No results found for username "${username}"`);
        }
      } catch (error) {
        throw new Error(
          `Failed to resolve username "${username}": ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return resolvedPubkeys;
  } catch (error) {
    throw new Error(
      `Username resolution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Convert parsed query to Nostr filters with username resolution
export async function queryToFiltersWithResolution(
  parsedQuery: ParsedQuery,
): Promise<Filter[]> {
  // Resolve usernames to pubkeys using lookup - this will throw if resolution fails
  const resolvedPubkeys = await resolveUsernames(parsedQuery.usernames);

  // Create a new parsed query with resolved pubkeys added to authors
  const resolvedQuery: ParsedQuery = {
    ...parsedQuery,
    authors: [...parsedQuery.authors, ...resolvedPubkeys],
    usernames: [], // Clear usernames since they're now resolved
  };

  return queryToFilters(resolvedQuery);
}

// Convert parsed query to Nostr filters (synchronous version for backward compatibility)
export function queryToFilters(parsedQuery: ParsedQuery): Filter[] {
  const filters: Filter[] = [];

  const baseFilter: Filter = {
    limit: 500,
  };

  if (parsedQuery.kinds.length > 0) {
    // Only add kinds filter if specific kinds are specified
    baseFilter.kinds = parsedQuery.kinds;
  }

  // Add search text if present and not empty
  if (parsedQuery.searchText && parsedQuery.searchText.trim()) {
    baseFilter.search = parsedQuery.searchText.trim();
  }

  // Add authors if specified and not empty
  if (parsedQuery.authors && parsedQuery.authors.length > 0) {
    // Filter out empty or invalid authors
    const validAuthors = parsedQuery.authors.filter(
      (author) => author && author.trim(),
    );
    if (validAuthors.length > 0) {
      baseFilter.authors = validAuthors;
    }
  }

  // Add tags if specified and not empty
  if (parsedQuery.tags) {
    Object.entries(parsedQuery.tags).forEach(([tagName, tagValues]) => {
      if (tagValues && Array.isArray(tagValues) && tagValues.length > 0) {
        // Filter out empty or invalid tag values
        const validTagValues = tagValues.filter(
          (value) => value && value.trim(),
        );
        if (validTagValues.length > 0) {
          baseFilter[`#${tagName}`] = validTagValues;
        }
      }
    });
  }

  // Add hashtags as #t tags if specified and not empty
  if (parsedQuery.hashtags && parsedQuery.hashtags.length > 0) {
    // Filter out empty or invalid hashtags
    const validHashtags = parsedQuery.hashtags.filter(
      (hashtag) => hashtag && hashtag.trim(),
    );
    if (validHashtags.length > 0) {
      // Initialize #t array if it doesn't exist
      if (!baseFilter["#t"]) {
        baseFilter["#t"] = [];
      }
      // Add hashtags to the #t array
      baseFilter["#t"].push(...validHashtags);
    }
  }

  // Add time filters (only if they are valid numbers)
  if (
    parsedQuery.since &&
    typeof parsedQuery.since === "number" &&
    parsedQuery.since > 0
  ) {
    baseFilter.since = parsedQuery.since;
  }
  if (
    parsedQuery.until &&
    typeof parsedQuery.until === "number" &&
    parsedQuery.until > 0
  ) {
    baseFilter.until = parsedQuery.until;
  }

  // Add limit (only if it's a valid positive number)
  if (
    parsedQuery.limit &&
    typeof parsedQuery.limit === "number" &&
    parsedQuery.limit > 0
  ) {
    baseFilter.limit = parsedQuery.limit;
  }

  filters.push(baseFilter);

  // Debug logging to help troubleshoot filter issues
  console.log("Generated filter:", JSON.stringify(baseFilter, null, 2));

  return filters;
}
