import { createSignal, Show, For } from "solid-js";
import type { NostrDBConfig } from "window.nostrdb.js/dist/interface";
import {
  getConfig,
  updateConfig,
  resetConfig,
} from "../services/ConfigService";

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ProviderId = "vertex" | "primal" | "local" | "relatr";

interface Provider {
  id: ProviderId;
  enabled: boolean;
  name: string;
  description: string;
}

export default function ConfigModal(props: ConfigModalProps) {
  // Load current config
  const currentConfig = getConfig();

  // Initialize providers array from config, preserving order
  const initProviders = (): Provider[] => {
    const configProviders = currentConfig.lookupProviders || [
      "vertex",
      "primal",
      "local",
    ];
    const allProviders: Record<ProviderId, Omit<Provider, "id" | "enabled">> = {
      vertex: {
        name: "Vertex",
        description:
          "Uses Vertex relay for user search (requires window.nostr)",
      },
      primal: {
        name: "Primal",
        description: "Uses Primal cache server for user search",
      },
      local: {
        name: "Local",
        description: "Uses local relays for user search",
      },
      relatr: {
        name: "Relatr",
        description: "Uses Relatr server for user search",
      },
    };

    // Create ordered list from config
    const orderedProviders: Provider[] = configProviders.map((id) => ({
      id,
      enabled: true,
      ...allProviders[id],
    }));

    // Add any missing providers at the end (disabled)
    const existingIds = new Set(configProviders);
    (Object.keys(allProviders) as ProviderId[]).forEach((id) => {
      if (!existingIds.has(id)) {
        orderedProviders.push({
          id,
          enabled: false,
          ...allProviders[id],
        });
      }
    });

    return orderedProviders;
  };

  // Form state
  const [providers, setProviders] = createSignal<Provider[]>(initProviders());
  const [expandedProvider, setExpandedProvider] =
    createSignal<ProviderId | null>(null);

  const [localRelays, setLocalRelays] = createSignal(
    currentConfig.localRelays?.join("\n") || "",
  );
  const [primalCache, setPrimalCache] = createSignal(
    currentConfig.primal?.cache || "",
  );
  const [vertexRelay, setVertexRelay] = createSignal(
    currentConfig.vertex?.relay || "",
  );
  const [vertexMethod, setVertexMethod] = createSignal(
    currentConfig.vertex?.method || "globalPagerank",
  );
  const [relatrPubkey, setRelatrPubkey] = createSignal(
    currentConfig.relatr?.pubkey || "",
  );
  const [relatrRelays, setRelatrRelays] = createSignal(
    currentConfig.relatr?.relays?.join("\n") || "",
  );
  const [blossomProxy, setBlossomProxy] = createSignal(
    currentConfig.blossomProxy || "",
  );

  const [saveSuccess, setSaveSuccess] = createSignal(false);

  // Helper functions for reordering providers
  const moveProviderUp = (index: number) => {
    if (index === 0) return;
    setProviders((prev) => {
      const newProviders = [...prev];
      [newProviders[index - 1], newProviders[index]] = [
        newProviders[index],
        newProviders[index - 1],
      ];
      return newProviders;
    });
  };

  const moveProviderDown = (index: number) => {
    const currentProviders = providers();
    if (index === currentProviders.length - 1) return;
    setProviders((prev) => {
      const newProviders = [...prev];
      [newProviders[index], newProviders[index + 1]] = [
        newProviders[index + 1],
        newProviders[index],
      ];
      return newProviders;
    });
  };

  const toggleProvider = (id: ProviderId, enabled: boolean) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled } : p)),
    );
  };

  const toggleExpanded = (id: ProviderId) => {
    setExpandedProvider((prev) => (prev === id ? null : id));
  };

  const handleSave = () => {
    // Build lookup provider order from providers signal
    const enabledProviders = providers()
      .filter((p) => p.enabled)
      .map((p) => p.id);

    // Parse local relays
    const parsedLocalRelays = localRelays()
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    // Parse relatr relays
    const parsedRelatrRelays = relatrRelays()
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    // Check if each provider is enabled
    const primalEnabled =
      providers().find((p) => p.id === "primal")?.enabled ?? false;
    const vertexEnabled =
      providers().find((p) => p.id === "vertex")?.enabled ?? false;
    const relatrEnabled =
      providers().find((p) => p.id === "relatr")?.enabled ?? false;

    const updates: Partial<NostrDBConfig> & { blossomProxy?: string } = {
      // Only set localRelays if not empty, otherwise let library use defaults
      ...(parsedLocalRelays.length > 0
        ? { localRelays: parsedLocalRelays }
        : {}),
      primal: primalEnabled
        ? {
            cache: primalCache().trim() || undefined,
          }
        : undefined,
      vertex: vertexEnabled
        ? {
            relay: vertexRelay().trim() || undefined,
            method: vertexMethod(),
          }
        : undefined,
      relatr:
        relatrEnabled && relatrPubkey().trim()
          ? {
              pubkey: relatrPubkey().trim(),
              relays: parsedRelatrRelays,
            }
          : undefined,
      lookupProviders:
        enabledProviders.length > 0 ? enabledProviders : ["local"],
      blossomProxy: blossomProxy().trim() || undefined,
    };

    // Show success message before reload
    setSaveSuccess(true);

    // Update config (this will trigger a page reload)
    setTimeout(() => {
      updateConfig(updates);
    }, 500);
  };

  const handleReset = () => {
    // Show success message before reload
    setSaveSuccess(true);

    // Reset config (this will trigger a page reload)
    setTimeout(() => {
      resetConfig();
    }, 500);
  };

  const handleCancel = () => {
    props.onClose();
  };

  return (
    <div class={`modal ${props.isOpen ? "modal-open" : ""}`}>
      <div class="modal-box max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <h3 class="font-bold text-lg mb-4">NostrDB Configuration</h3>

        <div class="space-y-6 w-full">
          {/* Local Relays */}
          <fieldset class="w-full">
            <label class="label">
              <span class="label-text font-semibold">Local Relay URLs</span>
              <span class="label-text-alt text-base-content/60">Optional</span>
            </label>
            <textarea
              placeholder="ws://localhost:8080&#10;ws://localhost:8081"
              class="textarea textarea-bordered w-full"
              rows={3}
              value={localRelays()}
              onInput={(e) => setLocalRelays(e.currentTarget.value)}
            />
            <div class="label">
              <span class="label-text-alt text-base-content/60">
                One relay URL per line. Leave empty to use library defaults.
              </span>
            </div>
          </fieldset>

          {/* Blossom Proxy */}
          <fieldset class="w-full">
            <label class="label">
              <span class="label-text font-semibold">Blossom Proxy URL</span>
              <span class="label-text-alt text-base-content/60">Optional</span>
            </label>
            <input
              type="text"
              placeholder="http://localhost:3000"
              class="input input-bordered w-full"
              value={blossomProxy()}
              onInput={(e) => setBlossomProxy(e.currentTarget.value)}
            />
            <div class="label">
              <span class="label-text-alt text-base-content/60">
                Blossom proxy server URL for caching blossom files.
              </span>
            </div>
          </fieldset>

          {/* Lookup Providers */}
          <div class="divider">Lookup Providers</div>

          <div class="label">
            <span class="label-text-alt">
              Providers are tried in order from top to bottom. Use the arrow
              buttons to reorder and toggle switches to enable/disable.
            </span>
          </div>

          <div class="space-y-2 w-full">
            <For each={providers()}>
              {(provider, index) => (
                <div
                  class={`border rounded-lg p-2 w-full ${!provider.enabled ? "opacity-50" : ""}`}
                >
                  <div class="flex items-center gap-2 w-full">
                    {/* Reorder buttons */}
                    <div class="flex flex-col shrink-0">
                      <button
                        class="btn btn-ghost btn-xs"
                        disabled={index() === 0}
                        onClick={() => moveProviderUp(index())}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        class="btn btn-ghost btn-xs"
                        disabled={index() === providers().length - 1}
                        onClick={() => moveProviderDown(index())}
                        title="Move down"
                      >
                        ↓
                      </button>
                    </div>

                    {/* Provider info */}
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold">{provider.name}</div>
                      <div class="label-text-alt">{provider.description}</div>
                    </div>

                    {/* Expand button (only for providers with settings) */}
                    <Show when={provider.id !== "local"}>
                      <button
                        class="btn btn-ghost btn-sm flex-shrink-0"
                        onClick={() => toggleExpanded(provider.id)}
                      >
                        {expandedProvider() === provider.id ? "▼" : "▶"}
                      </button>
                    </Show>

                    {/* Enable toggle */}
                    <input
                      type="checkbox"
                      class="toggle flex-shrink-0"
                      checked={provider.enabled}
                      onChange={(e) =>
                        toggleProvider(provider.id, e.currentTarget.checked)
                      }
                    />
                  </div>

                  {/* Provider-specific settings */}
                  <Show
                    when={
                      expandedProvider() === provider.id && provider.enabled
                    }
                  >
                    <div class="mt-2 pl-8 space-y-2 border-t pt-2">
                      {/* Primal settings */}
                      <Show when={provider.id === "primal"}>
                        <fieldset class="w-full">
                          <label class="label">
                            <span class="label-text">
                              Primal Cache Server URL
                            </span>
                            <span class="label-text-alt">Optional</span>
                          </label>
                          <input
                            type="text"
                            placeholder="https://primal.net/api"
                            class="input input-bordered w-full"
                            value={primalCache()}
                            onInput={(e) =>
                              setPrimalCache(e.currentTarget.value)
                            }
                          />
                          <div class="label">
                            <span class="label-text-alt">
                              Override the default Primal cache server
                            </span>
                          </div>
                        </fieldset>
                      </Show>

                      {/* Vertex settings */}
                      <Show when={provider.id === "vertex"}>
                        <fieldset class="w-full">
                          <label class="label">
                            <span class="label-text">Vertex Relay URL</span>
                            <span class="label-text-alt">Optional</span>
                          </label>
                          <input
                            type="text"
                            placeholder="wss://relay.vertex.com"
                            class="input input-bordered w-full"
                            value={vertexRelay()}
                            onInput={(e) =>
                              setVertexRelay(e.currentTarget.value)
                            }
                          />
                          <div class="label">
                            <span class="label-text-alt">
                              Override the default Vertex relay
                            </span>
                          </div>
                        </fieldset>

                        <fieldset class="w-full">
                          <label class="label">
                            <span class="label-text">Sort Method</span>
                          </label>
                          <select
                            class="select select-bordered w-full"
                            value={vertexMethod()}
                            onChange={(e) =>
                              setVertexMethod(e.currentTarget.value as any)
                            }
                          >
                            <option value="globalPagerank">
                              Global Pagerank
                            </option>
                            <option value="userPagerank">User Pagerank</option>
                            <option value="followDistance">
                              Follow Distance
                            </option>
                          </select>
                          <div class="label">
                            <span class="label-text-alt">
                              Method to use for sorting Vertex search results
                            </span>
                          </div>
                        </fieldset>
                      </Show>

                      {/* Relatr settings */}
                      <Show when={provider.id === "relatr"}>
                        <fieldset class="w-full">
                          <label class="label">
                            <span class="label-text">Relatr Server Pubkey</span>
                            <span class="label-text-alt">Required</span>
                          </label>
                          <input
                            type="text"
                            placeholder="npub1... or hex pubkey"
                            class="input input-bordered w-full font-mono"
                            value={relatrPubkey()}
                            onInput={(e) =>
                              setRelatrPubkey(e.currentTarget.value)
                            }
                          />
                          <div class="label">
                            <span class="label-text-alt">
                              Public key of the Relatr server
                            </span>
                          </div>
                        </fieldset>

                        <fieldset class="w-full">
                          <label class="label">
                            <span class="label-text">Relatr Relay URLs</span>
                            <span class="label-text-alt">Required</span>
                          </label>
                          <textarea
                            placeholder="wss://relay1.example.com&#10;wss://relay2.example.com"
                            class="textarea textarea-bordered w-full"
                            rows={3}
                            value={relatrRelays()}
                            onInput={(e) =>
                              setRelatrRelays(e.currentTarget.value)
                            }
                          />
                          <div class="label">
                            <span class="label-text-alt">
                              One relay URL per line to connect to Relatr server
                            </span>
                          </div>
                        </fieldset>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Success Message */}
        <Show when={saveSuccess()}>
          <div class="alert alert-success mt-4">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Configuration saved successfully!</span>
          </div>
        </Show>

        {/* Action Buttons */}
        <div class="modal-action">
          <button class="btn btn-ghost" onClick={handleReset}>
            Reset to Defaults
          </button>
          <button class="btn btn-ghost" onClick={handleCancel}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
