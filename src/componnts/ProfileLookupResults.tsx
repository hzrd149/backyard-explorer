import { For, createSignal, createEffect } from "solid-js";
import type { ProfilePointer } from "nostr-tools/nip19";
import type { NostrEvent } from "nostr-tools";
import ProfileCard from "./events/ProfileCard";

interface ProfileLookupResultsProps {
  profiles: ProfilePointer[];
  isLoading: boolean;
  error: string | null;
}

interface ProfileWithEvent {
  profile: ProfilePointer;
  event: NostrEvent | null;
  loading: boolean;
  error: string | null;
}

export default function ProfileLookupResults(props: ProfileLookupResultsProps) {
  const [profileStates, setProfileStates] = createSignal<ProfileWithEvent[]>(
    [],
  );

  // Initialize profile states when profiles change
  createEffect(() => {
    if (props.profiles.length === 0) {
      setProfileStates([]);
      return;
    }

    const states: ProfileWithEvent[] = props.profiles.map((profile) => ({
      profile,
      event: null,
      loading: true,
      error: null,
    }));
    setProfileStates(states);

    // Fetch profile events for each profile
    props.profiles.forEach(async (profile, index) => {
      try {
        const db = window.nostrdb;
        if (!db) {
          throw new Error("NostrDB not available");
        }

        const profileEvent = await db.replaceable(0, profile.pubkey);

        setProfileStates((prev) =>
          prev.map((state, i) =>
            i === index
              ? { ...state, event: profileEvent || null, loading: false }
              : state,
          ),
        );
      } catch (error) {
        setProfileStates((prev) =>
          prev.map((state, i) =>
            i === index
              ? {
                  ...state,
                  loading: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to fetch profile",
                }
              : state,
          ),
        );
      }
    });
  });

  return (
    <div class="w-full max-w-4xl mx-auto">
      <h2 class="text-2xl font-bold mb-4">Profile Lookup Results</h2>

      {props.isLoading && (
        <div class="flex justify-center items-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
          <span class="ml-2">Searching profiles...</span>
        </div>
      )}

      {props.error && (
        <div class="alert alert-error">
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
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{props.error}</span>
        </div>
      )}

      {!props.isLoading && !props.error && props.profiles.length === 0 && (
        <div class="alert alert-info">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-current shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>No profiles found</span>
        </div>
      )}

      {!props.isLoading && !props.error && props.profiles.length > 0 && (
        <div class="grid gap-4">
          <div class="text-sm text-base-content/70 mb-2">
            Found {props.profiles.length} profile(s)
          </div>
          <For each={profileStates()}>
            {(profileState) => (
              <div>
                {profileState.loading ? (
                  <div class="card bg-base-100 shadow-sm border border-base-300">
                    <div class="card-body p-4">
                      <div class="flex items-center gap-4">
                        <div class="avatar placeholder">
                          <div class="bg-neutral text-neutral-content rounded-full w-12">
                            <span class="text-xs">?</span>
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="flex items-center gap-2">
                            <span class="loading loading-spinner loading-sm"></span>
                            <span class="font-mono text-sm text-base-content/70">
                              {profileState.profile.pubkey}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : profileState.error ? (
                  <div class="card bg-base-100 shadow-sm border border-base-300">
                    <div class="card-body p-4">
                      <div class="flex items-center gap-4">
                        <div class="avatar placeholder">
                          <div class="bg-error text-error-content rounded-full w-12">
                            <span class="text-xs">!</span>
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="text-sm text-error">
                            Failed to load profile: {profileState.error}
                          </div>
                          <div class="font-mono text-xs text-base-content/50 mt-1">
                            {profileState.profile.pubkey}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : profileState.event ? (
                  <ProfileCard profile={profileState.event} />
                ) : (
                  <div class="card bg-base-100 shadow-sm border border-base-300">
                    <div class="card-body p-4">
                      <div class="flex items-center gap-4">
                        <div class="avatar placeholder">
                          <div class="bg-neutral text-neutral-content rounded-full w-12">
                            <span class="text-xs">?</span>
                          </div>
                        </div>
                        <div class="flex-1">
                          <div class="text-sm text-base-content/70">
                            No profile data available
                          </div>
                          <div class="font-mono text-xs text-base-content/50 mt-1">
                            {profileState.profile.pubkey}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
