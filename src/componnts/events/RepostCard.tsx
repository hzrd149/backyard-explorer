import type { NostrEvent } from "nostr-tools";
import { createSignal, createEffect } from "solid-js";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";
import EventCard from "./EventCard";

import {
  getEmbededSharedEvent,
  getSharedEventPointer,
} from "applesauce-common/helpers";

interface RepostCardProps {
  repost: NostrEvent;
}

export default function RepostCard(props: RepostCardProps) {
  const [repostedEvent, setRepostedEvent] = createSignal<NostrEvent | null>(
    null,
  );
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  // Extract reposted event ID from tags using applesauce-core helper
  const getRepostedEventId = () => {
    const eventPointer = getSharedEventPointer(props.repost);
    return eventPointer?.id || null;
  };

  // Extract reposted event author from tags using applesauce-core helper
  const getRepostedEventAuthor = () => {
    const eventPointer = getSharedEventPointer(props.repost);
    return eventPointer?.author || null;
  };

  // Try to parse embedded event from content using applesauce-core helper
  const parseEmbeddedEvent = () => {
    return getEmbededSharedEvent(props.repost);
  };

  // Fetch event from nostrdb if not embedded
  const fetchRepostedEvent = async (eventId: string) => {
    if (!window.nostrdb) {
      setError("NostrDB not available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const event = await window.nostrdb.event(eventId);
      if (event) {
        setRepostedEvent(event);
      } else {
        setError("Event not found");
      }
    } catch (err) {
      setError("Failed to fetch event");
      console.error("Error fetching reposted event:", err);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    // First try to parse embedded event
    const embeddedEvent = parseEmbeddedEvent();
    if (embeddedEvent) {
      setRepostedEvent(embeddedEvent);
      return;
    }

    // If no embedded event, try to fetch from nostrdb
    const eventId = getRepostedEventId();
    if (eventId) {
      fetchRepostedEvent(eventId);
    } else {
      setError("No event ID found in repost");
    }
  });

  const repostedEventId = getRepostedEventId();
  const repostedEventAuthor = getRepostedEventAuthor();
  const isKind6 = props.repost.kind === 6;
  const isKind16 = props.repost.kind === 16;

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        {/* Repost Header */}
        <div class="flex items-start gap-3 mb-3">
          <UserAvatar pubkey={props.repost.pubkey} size="sm" />
          <div class="flex-1 min-w-0 overflow-hidden">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <UserName
                  pubkey={props.repost.pubkey}
                  showPubkey={false}
                  maxLength={15}
                  class="font-medium"
                />
                <div class="flex items-center gap-1 text-sm text-base-content/60">
                  <span>reposted</span>
                  <div class="badge badge-outline text-xs">
                    {isKind6
                      ? "Repost"
                      : isKind16
                        ? "Generic Repost"
                        : `Kind ${props.repost.kind}`}
                  </div>
                </div>
              </div>
              <span class="text-xs text-base-content/50">
                {formatDate(props.repost.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Reposted Event Content */}
        <div class="ml-8 border-l-2 border-base-300 pl-4">
          {loading() && (
            <div class="flex items-center gap-2 text-sm text-base-content/60">
              <span class="loading loading-spinner loading-xs"></span>
              <span>Loading reposted content...</span>
            </div>
          )}

          {error() && (
            <div class="alert alert-warning">
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <div>
                <div class="font-bold">Unable to load reposted content</div>
                <div class="text-xs">{error()}</div>
                {repostedEventId && (
                  <div class="text-xs mt-1">
                    Event ID: {repostedEventId.slice(0, 12)}...
                  </div>
                )}
              </div>
            </div>
          )}

          {repostedEvent() && !loading() && !error() && (
            <div class="reposted-event">
              <EventCard event={repostedEvent()!} />
            </div>
          )}

          {/* Fallback info when event can't be loaded */}
          {!repostedEvent() && !loading() && !error() && (
            <div class="text-sm text-base-content/60">
              <div class="flex items-center gap-2 mb-2">
                <span>Reposted content unavailable</span>
              </div>
              {repostedEventId && (
                <div class="text-xs text-base-content/40">
                  Event ID: {repostedEventId.slice(0, 12)}...
                </div>
              )}
              {repostedEventAuthor && (
                <div class="text-xs text-base-content/40">
                  Author: {repostedEventAuthor.slice(0, 12)}...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
