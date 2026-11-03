import type { NostrEvent } from "nostr-tools";

/** Props shared by every display mode component */
export interface DisplayProps {
  events: NostrEvent[];
}
