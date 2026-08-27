import type { NostrDBConfig } from "window.nostrdb.js/dist/interface";

const CONFIG_STORAGE_KEY = "nostrdb-config";
const LOCAL_BLOSSOM_PROXY_URL = "http://localhost:24242";
const LOCAL_BLOSSOM_PROBE_TIMEOUT = 1_000;

/** Default local relay the app routes window.nostrdb requests to */
export const DEFAULT_LOCAL_RELAYS = ["ws://localhost:4869/"];

export const DEFAULT_NIP50_RELAY = "wss://relay.ditto.pub";
export const DEFAULT_OPEN_RANKING_PROVIDER_URL =
  "https://ranking.vertexlab.io/";
export const OPEN_RANKING_PROVIDER_URLS = [
  DEFAULT_OPEN_RANKING_PROVIDER_URL,
  "https://staging.brainstorm.world",
] as const;

/** Ordered lookup providers used when the user has not configured any */
export const DEFAULT_LOOKUP_PROVIDERS: LookupProviderId[] = [
  "openranking",
  "nip50",
  "local",
];

export type LookupProviderId =
  "primal" | "local" | "nip50" | "relatr" | "openranking";

export type Config = Partial<NostrDBConfig> & {
  blossomProxy?: string;
  /** Ordered array of lookup providers to try (in order) */
  lookupProviders?: LookupProviderId[];
  /** Primal lookup provider settings */
  primal?: { cache?: string };
  /** Simple remote NIP-50 relay lookup provider settings */
  nip50?: { relay?: string };
  /** Relatr (ContextVM MCP) lookup provider settings */
  relatr?: { pubkey?: string; relays?: string[] };
  /** Open Ranking lookup provider settings */
  openRanking?: { provider?: string };
};

let detectedBlossomProxy: string | undefined;

// Initialize config immediately when this module loads (before any imports)
// This ensures window.nostrdbConfig is set before window.nostrdb.js initializes
(function initializeConfig() {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);

    const parsed: Config = stored ? JSON.parse(stored) : {};

    // The library no longer defaults to the local relay, so the app provides
    // its own default unless the user explicitly configured relays
    (window as any).nostrdbConfig = {
      localRelays: DEFAULT_LOCAL_RELAYS,
      ...parsed,
    };
  } catch (error) {
    console.error("Failed to initialize config:", error);

    // Fall back to app defaults on error
    (window as any).nostrdbConfig = { localRelays: DEFAULT_LOCAL_RELAYS };
  }
})();

/** Load configuration from localStorage merged with app defaults */
export function loadConfig(): Config {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed: Config = JSON.parse(stored);
      return {
        localRelays: parsed.localRelays ?? DEFAULT_LOCAL_RELAYS,
        lookupProviders: parsed.lookupProviders ?? DEFAULT_LOOKUP_PROVIDERS,
        ...parsed,
      };
    }
  } catch (error) {
    console.error("Failed to load config from localStorage:", error);
  }

  return {
    localRelays: DEFAULT_LOCAL_RELAYS,
    lookupProviders: DEFAULT_LOOKUP_PROVIDERS,
  };
}

/** Save configuration to localStorage */
export function saveConfig(config: Config): void {
  try {
    // Create a serializable version
    const serializable: Config = {};

    if (config.localRelays) serializable.localRelays = config.localRelays;
    if (config.lookupProviders)
      serializable.lookupProviders = config.lookupProviders;
    if (config.primal) serializable.primal = config.primal;
    if (config.nip50) serializable.nip50 = config.nip50;
    if (config.relatr) serializable.relatr = config.relatr;
    if (config.openRanking) serializable.openRanking = config.openRanking;
    if (config.blossomProxy) serializable.blossomProxy = config.blossomProxy;

    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.error("Failed to save config to localStorage:", error);
  }
}

/** Get current configuration */
export function getConfig(): Config {
  return window.nostrdbConfig || loadConfig();
}

/** Get the ordered list of enabled lookup providers */
export function getLookupProviders(): LookupProviderId[] {
  const config = getConfig();
  return config.lookupProviders?.length
    ? config.lookupProviders
    : DEFAULT_LOOKUP_PROVIDERS;
}

/** Update configuration and apply to window.nostrdbConfig */
export function updateConfig(updates: Config): void {
  const currentConfig = getConfig();
  const newConfig: Config = {
    ...currentConfig,
    ...updates,
  } as Config;

  // Apply to window
  (window as any).nostrdbConfig = newConfig;

  // Save to localStorage
  saveConfig(newConfig);

  // Reload the page to apply changes (window.nostrdb.js needs to reinitialize)
  window.location.reload();
}

/** Reset configuration to defaults */
export function resetConfig(): void {
  // Clear the config completely to use app defaults
  localStorage.removeItem(CONFIG_STORAGE_KEY);

  // Clear window config
  delete (window as any).nostrdbConfig;

  // Reload the page to apply changes (window.nostrdb.js needs to reinitialize)
  window.location.reload();
}

/** Get Blossom proxy URL from configuration */
export function getBlossomProxyUrl(): string | undefined {
  const config = getConfig();
  return config.blossomProxy || detectedBlossomProxy;
}

/** Detect the conventional local Blossom server unless the user configured one. */
export async function detectLocalBlossomProxy(): Promise<string | undefined> {
  const configuredProxy = getConfig().blossomProxy;
  if (configuredProxy) return configuredProxy;

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    LOCAL_BLOSSOM_PROBE_TIMEOUT,
  );

  try {
    await fetch(LOCAL_BLOSSOM_PROXY_URL, {
      cache: "no-store",
      credentials: "omit",
      mode: "no-cors",
      signal: controller.signal,
    });
    detectedBlossomProxy = LOCAL_BLOSSOM_PROXY_URL;
  } catch {
    detectedBlossomProxy = undefined;
  } finally {
    window.clearTimeout(timeout);
  }

  return detectedBlossomProxy;
}
