import type { NostrEvent } from "nostr-tools";
import { For, createSignal, createEffect } from "solid-js";
import { fetchProfile, getDisplayName } from "../../services/ProfileService";
import { npubEncode } from "nostr-tools/nip19";
import UserProfile from "../UserProfile";

interface ContactListCardProps {
  contactList: NostrEvent;
}

interface ContactWithProfile {
  pubkey: string;
  relay: string;
  petname: string;
  username?: string;
  profile?: any;
}

interface ContactGroup {
  contacts: ContactWithProfile[];
  groupName?: string;
}

export default function ContactListCard(props: ContactListCardProps) {
  const [contactGroups, setContactGroups] = createSignal<ContactGroup[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getContacts = () => {
    if (!props.contactList.tags) return [];

    return props.contactList.tags
      .filter((tag) => tag[0] === "p" && tag[1])
      .map((tag) => ({
        pubkey: tag[1],
        relay: tag[2] || "",
        petname: tag[3] || "",
      }));
  };

  const loadContactProfiles = async () => {
    const contacts = getContacts();
    setIsLoading(true);

    try {
      // Limit to first 10 contacts only
      const limitedContacts = contacts.slice(0, 10);
      const contactsWithProfiles: ContactWithProfile[] = [];

      // Fetch profiles for each contact
      for (const contact of limitedContacts) {
        try {
          const profile = await fetchProfile(contact.pubkey);
          const username = profile
            ? getDisplayName(profile, npubEncode(contact.pubkey))
            : undefined;

          contactsWithProfiles.push({
            ...contact,
            username,
            profile,
          });
        } catch (error) {
          console.warn("Failed to fetch profile for", contact.pubkey, error);
          contactsWithProfiles.push({
            ...contact,
            username: undefined,
            profile: undefined,
          });
        }
      }

      // Create a single group with the limited contacts
      setContactGroups([
        {
          contacts: contactsWithProfiles,
          groupName: "Contacts",
        },
      ]);
    } catch (error) {
      console.error("Failed to load contact profiles", error);
      // Fallback to basic contacts without profiles
      const limitedContacts = contacts.slice(0, 10);
      setContactGroups([
        {
          contacts: limitedContacts.map((contact) => ({
            ...contact,
            username: undefined,
            profile: undefined,
          })),
          groupName: "Contacts",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    loadContactProfiles();
  });

  const totalContacts = () => {
    return getContacts().length;
  };

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        <div class="flex items-start gap-4">
          <div class="flex-1 min-w-0">
            {/* Main user profile header */}
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

            <div class="mb-3">
              <h4 class="font-semibold text-sm mb-3">
                {isLoading()
                  ? "Loading..."
                  : `${totalContacts()} Contact${totalContacts() !== 1 ? "s" : ""}${totalContacts() > 10 ? ` (showing first 10)` : ""}`}
              </h4>

              {isLoading() ? (
                <div class="flex items-center justify-center py-8">
                  <span class="loading loading-spinner loading-md"></span>
                </div>
              ) : contactGroups().length > 0 ? (
                <div class="space-y-2 max-h-64 overflow-y-auto">
                  <For each={contactGroups()[0]?.contacts || []}>
                    {(contact) => (
                      <div class="flex items-center justify-between text-xs bg-base-200 rounded p-2">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                          <div class="w-6 h-6 rounded-full bg-base-300 flex items-center justify-center text-xs font-mono">
                            {contact.pubkey.slice(0, 2).toUpperCase()}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="font-semibold truncate">
                              {contact.username ||
                                contact.petname ||
                                `${contact.pubkey.slice(0, 12)}...`}
                            </div>
                            <div class="text-base-content/70 truncate font-mono text-xs">
                              {contact.pubkey.slice(0, 16)}...
                            </div>
                          </div>
                        </div>
                        {contact.relay && (
                          <div class="text-base-content/50 ml-2 truncate max-w-20 text-xs">
                            {contact.relay}
                          </div>
                        )}
                      </div>
                    )}
                  </For>
                  {totalContacts() > 10 && (
                    <div class="text-xs text-base-content/50 text-center py-2">
                      ... and {totalContacts() - 10} more contacts
                    </div>
                  )}
                </div>
              ) : (
                <p class="text-base-content/50 text-sm">No contacts found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
