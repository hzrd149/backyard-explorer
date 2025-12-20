import type { NostrDBConfig } from "window.nostrdb.js/dist/interface";

const CONFIG_STORAGE_KEY = "nostrdb-config";

export type Config = Partial<NostrDBConfig> & { blossomProxy?: string };

// Initialize config immediately when this module loads (before any imports)
// This ensures window.nostrdbConfig is set before window.nostrdb.js initializes
(function initializeConfig() {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);

    if (stored) {
      const parsed: Config = JSON.parse(stored);
      // Only set config if user has saved preferences
      // This allows window.nostrdb.js to use its own defaults for unset fields
      (window as any).nostrdbConfig = parsed;
    }
    // If no stored config, don't set window.nostrdbConfig at all
    // Let window.nostrdb.js use its built-in defaults
  } catch (error) {
    console.error("Failed to initialize config:", error);
    // Don't set any config on error - let library use defaults
  }
})();

/** Load configuration from localStorage */
export function loadConfig(): Config {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load config from localStorage:", error);
  }

  return {};
}

/** Save configuration to localStorage */
export function saveConfig(config: Config): void {
  try {
    // Create a serializable version (remove functions like vertex.signer)
    const serializable: Config = {};

    if (config.localRelays) serializable.localRelays = config.localRelays;
    if (config.primal) serializable.primal = config.primal;
    if (config.vertex) {
      serializable.vertex = {
        relay: config.vertex.relay,
        method: config.vertex.method,
        // Don't serialize signer function
      };
    }
    if (config.relatr) serializable.relatr = config.relatr;
    if (config.lookupProviders)
      serializable.lookupProviders = config.lookupProviders;
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
  // Clear the config completely to use library defaults
  localStorage.removeItem(CONFIG_STORAGE_KEY);

  // Clear window config
  delete (window as any).nostrdbConfig;

  // Reload the page to apply changes (window.nostrdb.js needs to reinitialize)
  window.location.reload();
}

/** Initialize configuration on app startup */
export function initConfig(): Partial<NostrDBConfig> {
  const config = loadConfig();
  if (Object.keys(config).length > 0) {
    (window as any).nostrdbConfig = config;
  }
  // If config is empty, don't set anything - let library use defaults
  return config;
}

/** Get Blossom proxy URL from configuration */
export function getBlossomProxyUrl(): string | undefined {
  const config = getConfig();
  return (config as any).blossomProxy;
}
