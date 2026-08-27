import { Client } from "@contextvm/mcp-sdk/client/index.js";
import {
  ApplesauceRelayPool,
  NostrClientTransport,
  PrivateKeySigner,
} from "@contextvm/sdk";
import {
  DEFAULT_PRIMAL_RELAY,
  OpenRanking,
  PrimalCache,
} from "applesauce-extra";
import type { NostrEvent } from "nostr-tools";
import type { ProfilePointer } from "nostr-tools/nip19";
import { SimplePool } from "nostr-tools/pool";
import {
  DEFAULT_NIP50_RELAY,
  DEFAULT_OPEN_RANKING_PROVIDER_URL,
  getLookupProviders,
  getConfig,
  type Config,
  type LookupProviderId,
} from "./ConfigService";

/** Default Relatr server (ContextVM MCP over Nostr) */
const RELATR_SERVER_PUBKEY =
  "750682303c9f0ddad75941b49edc9d46e3ed306b9ee3335338a21a3e404c5fa3";
const RELATR_DEFAULT_RELAYS = ["wss://relay.contextvm.org"];

/**
 * Client for the Relatr trust-scored profile search server, which speaks
 * MCP (Model Context Protocol) over Nostr via ContextVM
 */
class RelatrClient {
  private client: Client;
  private transport: NostrClientTransport;

  constructor(
    options: {
      serverPubkey?: string;
      relays?: string[];
    } = {},
  ) {
    this.client = new Client({ name: "RelatrClient", version: "1.0.0" });

    this.transport = new NostrClientTransport({
      serverPubkey: options.serverPubkey || RELATR_SERVER_PUBKEY,
      signer: new PrivateKeySigner(),
      relayHandler: new ApplesauceRelayPool(
        options.relays || RELATR_DEFAULT_RELAYS,
      ),
      isStateless: true,
    });

    // Auto-connect in constructor
    this.client.connect(this.transport).catch((error) => {
      console.error(`Failed to connect to Relatr server: ${error}`);
    });
  }

  async disconnect(): Promise<void> {
    await this.transport.close();
  }

  private async call(name: string, args: Record<string, unknown>) {
    const result = await this.client.callTool({
      name,
      arguments: { ...args },
    });
    return (result as any).structuredContent;
  }

  /**
   * Search for Nostr profiles by name/query and return results sorted by
   * trust score
   */
  async searchProfiles(query: string, limit = 10) {
    return this.call("search_profiles", { query, limit });
  }
}

let relatrClient: RelatrClient | null = null;
let relatrConfigKey = "";

function getRelatrClient(config: Config): RelatrClient {
  const pubkey = config.relatr?.pubkey || RELATR_SERVER_PUBKEY;
  const relays =
    config.relatr?.relays && config.relatr.relays.length > 0
      ? config.relatr.relays
      : RELATR_DEFAULT_RELAYS;

  const key = `${pubkey}|${relays.join(",")}`;
  if (!relatrClient || key !== relatrConfigKey) {
    relatrClient?.disconnect().catch(() => {});
    relatrClient = new RelatrClient({ serverPubkey: pubkey, relays });
    relatrConfigKey = key;
  }

  return relatrClient;
}

/** Store kind 0 profile events in the local database so they can be rendered */
async function storeProfileEvents(events: NostrEvent[]): Promise<void> {
  const db = window.nostrdb;
  if (!db) return;
  await Promise.allSettled(events.map((event) => db.add(event)));
}

/** Deduplicate profile events by pubkey, keeping the latest for each */
function dedupeProfiles(events: NostrEvent[]): NostrEvent[] {
  const pubkeyMap = new Map<string, NostrEvent>();
  for (const event of events) {
    const existing = pubkeyMap.get(event.pubkey);
    if (!existing || event.created_at > existing.created_at) {
      pubkeyMap.set(event.pubkey, event);
    }
  }
  return [...pubkeyMap.values()];
}

/** Lookup users using the Primal cache server */
async function primalLookup(
  query: string,
  config: Config,
  limit: number,
): Promise<ProfilePointer[]> {
  const cache = config.primal?.cache || DEFAULT_PRIMAL_RELAY;

  const primal = new PrimalCache(cache);
  try {
    const events = await primal.userSearch(query, limit);
    await storeProfileEvents(events);
    return dedupeProfiles(events).map((event) => ({
      pubkey: event.pubkey,
      relays: [cache],
    }));
  } finally {
    primal.close();
  }
}

/** Lookup users using NIP-50 search on the local database/relays */
async function localLookup(
  query: string,
  limit: number,
): Promise<ProfilePointer[]> {
  const db = window.nostrdb;
  if (!db) {
    throw new Error("NostrDB not available");
  }

  const features = await db.supports();
  if (!features.includes("search")) {
    throw new Error("Local database does not support NIP-50 search");
  }

  const events = await db.query([{ kinds: [0], search: query, limit }]);
  return dedupeProfiles(events).map((event) => ({ pubkey: event.pubkey }));
}

/** Lookup users using NIP-50 search on a simple remote relay */
async function nip50Lookup(
  query: string,
  config: Config,
  limit: number,
): Promise<ProfilePointer[]> {
  const relay = config.nip50?.relay || DEFAULT_NIP50_RELAY;

  const pool = new SimplePool();
  try {
    const events = await pool.querySync([relay], {
      kinds: [0],
      search: query,
      limit,
    });
    await storeProfileEvents(events);
    return dedupeProfiles(events).map((event) => ({
      pubkey: event.pubkey,
      relays: [relay],
    }));
  } finally {
    pool.close([relay]);
  }
}

/** Lookup users using the Relatr (ContextVM MCP) server */
async function relatrLookup(
  query: string,
  config: Config,
  limit: number,
): Promise<ProfilePointer[]> {
  const result = await getRelatrClient(config).searchProfiles(query, limit);
  const results = (result as { results?: { pubkey: string }[] })?.results;
  if (!results) return [];
  return results.map((r) => ({ pubkey: r.pubkey }));
}

/** Lookup users using an Open Ranking (ORE) provider */
async function openRankingLookup(
  query: string,
  config: Config,
  limit: number,
): Promise<ProfilePointer[]> {
  const provider =
    config.openRanking?.provider || DEFAULT_OPEN_RANKING_PROVIDER_URL;
  const openRanking = new OpenRanking(provider);
  return openRanking.userSearch(query, limit);
}

const lookupProviders: Record<
  LookupProviderId,
  (query: string, config: Config, limit: number) => Promise<ProfilePointer[]>
> = {
  primal: (query, config, limit) => primalLookup(query, config, limit),
  local: (query, _config, limit) => localLookup(query, limit),
  nip50: (query, config, limit) => nip50Lookup(query, config, limit),
  relatr: (query, config, limit) => relatrLookup(query, config, limit),
  openranking: (query, config, limit) =>
    openRankingLookup(query, config, limit),
};

/**
 * Lookup user profiles by search query, trying each configured provider in
 * order until one returns results
 */
export async function lookupProfiles(
  query: string,
  limit = 10,
): Promise<ProfilePointer[]> {
  const config = getConfig();
  const providers = getLookupProviders();
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const results = await lookupProviders[provider](query, config, limit);
      if (results.length > 0) {
        return results;
      }
      failures.push(`${provider}: no results`);
    } catch (error) {
      // If this provider fails, try the next one
      const message = error instanceof Error ? error.message : "unknown error";
      failures.push(`${provider}: ${message}`);
    }
  }

  throw new Error(
    `All lookup providers failed or returned no results (${failures.join("; ")})`,
  );
}
