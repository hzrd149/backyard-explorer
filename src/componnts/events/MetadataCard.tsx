import type { NostrEvent } from "nostr-tools";
import { For } from "solid-js";

interface MetadataCardProps {
  metadata: NostrEvent;
}

export default function MetadataCard(props: MetadataCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getRelays = () => {
    if (!props.metadata.tags) return [];

    return props.metadata.tags
      .filter((tag) => tag[0] === "r" && tag[1])
      .map((tag) => ({
        url: tag[1],
        read: tag[2] === "read" || tag[2] === "readwrite",
        write: tag[2] === "write" || tag[2] === "readwrite",
      }));
  };

  const relays = getRelays();

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        <div class="flex items-start gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="badge badge-outline text-xs">Relay List</div>
                <span class="text-sm text-base-content/70">
                  {props.metadata.pubkey.slice(0, 8)}...
                </span>
              </div>
              <span class="text-xs text-base-content/50">
                {formatDate(props.metadata.created_at)}
              </span>
            </div>

            <div class="mb-3">
              <h4 class="font-semibold text-sm mb-2">
                {relays.length} Relay{relays.length !== 1 ? "s" : ""}
              </h4>

              {relays.length > 0 ? (
                <div class="space-y-2 max-h-32 overflow-y-auto">
                  <For each={relays.slice(0, 10)}>
                    {(relay) => (
                      <div class="flex items-center justify-between text-xs bg-base-200 rounded p-2">
                        <div class="flex-1 min-w-0">
                          <div class="font-mono truncate">{relay.url}</div>
                        </div>
                        <div class="flex gap-1 ml-2">
                          {relay.read && (
                            <span class="badge badge-success badge-xs">R</span>
                          )}
                          {relay.write && (
                            <span class="badge badge-info badge-xs">W</span>
                          )}
                        </div>
                      </div>
                    )}
                  </For>
                  {relays.length > 10 && (
                    <div class="text-xs text-base-content/50 text-center">
                      ... and {relays.length - 10} more
                    </div>
                  )}
                </div>
              ) : (
                <p class="text-base-content/50 text-sm">No relays found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
