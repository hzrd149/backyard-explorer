import type { NostrEvent } from "nostr-tools";

/** Props shared by every display mode component */
export interface DisplayProps {
  /** The results loaded so far, newest first; more are appended as the list is scrolled */
  events: NostrEvent[];
  /** True once every matching result has been loaded */
  complete: boolean;
}
