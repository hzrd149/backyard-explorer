import { createMemo, For, Show } from "solid-js";
import { npubEncode } from "nostr-tools/nip19";
import { getProfileContent } from "applesauce-core/helpers";
import LazyImage from "../previews/LazyImage";
import UserAvatar from "../UserAvatar";
import HiddenResultsNotice from "./HiddenResultsNotice";
import type { DisplayProps } from "./types";

/** Grid of kind 0 profiles, one card per pubkey (newest metadata wins) */
export default function ProfileDirectory(props: DisplayProps) {
  const profiles = createMemo(() => {
    const latest = new Map<string, (typeof props.events)[number]>();
    for (const event of props.events) {
      if (event.kind !== 0) continue;
      const existing = latest.get(event.pubkey);
      if (!existing || existing.created_at < event.created_at)
        latest.set(event.pubkey, event);
    }
    return [...latest.values()];
  });
  const hidden = () => props.events.filter((e) => e.kind !== 0).length;

  return (
    <>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <For each={profiles()}>
          {(event) => {
            const profile = getProfileContent(event) ?? {};
            const name =
              profile.display_name || profile.name || profile.displayName;
            const npub = npubEncode(event.pubkey);
            return (
              <div class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
                <div class="h-20 bg-gradient-to-r from-primary/30 to-secondary/30 overflow-hidden">
                  <Show when={profile.banner}>
                    <LazyImage
                      src={profile.banner}
                      class="h-full w-full object-cover"
                      placeholderClass="h-full w-full rounded-none"
                    />
                  </Show>
                </div>
                <div class="card-body p-4 pt-0 gap-1">
                  <div class="-mt-8 mb-1">
                    <UserAvatar pubkey={event.pubkey} size="lg" />
                  </div>
                  <h3 class="font-semibold truncate">
                    {name || `${npub.slice(0, 12)}…`}
                  </h3>
                  <Show when={profile.nip05}>
                    <p class="text-xs font-mono text-base-content/60 truncate">
                      {profile.nip05}
                    </p>
                  </Show>
                  <Show when={profile.about}>
                    <p class="text-sm text-base-content/70 line-clamp-3">
                      {profile.about}
                    </p>
                  </Show>
                  <div class="mt-2 flex items-center gap-2 text-xs">
                    <Show when={profile.website}>
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link link-primary truncate max-w-[60%]"
                      >
                        {profile.website}
                      </a>
                    </Show>
                    <a
                      href={`https://npub.world/${npub}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ml-auto text-base-content/50 hover:text-base-content/70"
                    >
                      npub.world
                    </a>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
      <Show when={profiles().length === 0}>
        <p class="text-center text-base-content/50 mt-8">
          No profiles found in these results.
        </p>
      </Show>
      <HiddenResultsNotice count={hidden()} />
    </>
  );
}
