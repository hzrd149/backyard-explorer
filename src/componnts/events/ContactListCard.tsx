import type { NostrEvent } from "nostr-tools";
import { For } from "solid-js";
import UserProfile from "../UserProfile";

interface ContactListCardProps {
  contactList: NostrEvent;
}

export default function ContactListCard(props: ContactListCardProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const contacts = () =>
    (props.contactList.tags ?? [])
      .filter((tag) => tag[0] === "p" && tag[1])
      .map((tag) => ({
        pubkey: tag[1],
        relay: tag[2] || "",
        petname: tag[3] || "",
      }));

  const displayed = () => contacts().slice(0, 10);
  const overflow = () => contacts().length - displayed().length;

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <UserProfile
              pubkey={props.contactList.pubkey}
              avatarSize="sm"
              maxNameLength={20}
            />
            <div class="badge badge-outline text-xs">Contact List</div>
          </div>
          <span class="text-xs text-base-content/50">
            {formatDate(props.contactList.created_at)}
          </span>
        </div>

        {/* Count */}
        <h4 class="font-semibold text-sm mb-3">
          {contacts().length} Contact{contacts().length !== 1 ? "s" : ""}
          {contacts().length > 10 ? " (showing first 10)" : ""}
        </h4>

        {/* Contact rows */}
        {contacts().length > 0 ? (
          <div class="space-y-1 max-h-64 overflow-y-auto">
            <For each={displayed()}>
              {(contact) => (
                <div class="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-base-200 transition-colors">
                  <UserProfile
                    pubkey={contact.pubkey}
                    avatarSize="xs"
                    maxNameLength={24}
                  />
                  {contact.relay && (
                    <span class="text-base-content/40 truncate max-w-24 text-xs shrink-0">
                      {contact.relay.replace(/^wss?:\/\//, "")}
                    </span>
                  )}
                </div>
              )}
            </For>
            {overflow() > 0 && (
              <div class="text-xs text-base-content/50 text-center py-2">
                … and {overflow()} more
              </div>
            )}
          </div>
        ) : (
          <p class="text-base-content/50 text-sm">No contacts found</p>
        )}

        {/* Footer */}
        <div class="mt-4 pt-3 border-t border-base-300">
          <div class="flex items-center justify-between text-xs text-base-content/50">
            <span>Event ID: {props.contactList.id.slice(0, 12)}...</span>
            <span>Kind 3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
