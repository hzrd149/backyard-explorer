import type { NostrEvent } from "nostr-tools";
import { npubEncode } from "nostr-tools/nip19";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";

interface ProfileCardProps {
  profile: NostrEvent;
}

export default function ProfileCard(props: ProfileCardProps) {
  const { profile } = props;

  const profileData = () => {
    try {
      return JSON.parse(profile.content);
    } catch {
      return {};
    }
  };

  const about = () => profileData().about || "";
  const website = () => profileData().website || "";
  const nip05 = () => profileData().nip05 || "";
  const npub = () => npubEncode(profile.pubkey);

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow relative">
      <div class="card-body p-4">
        <div class="flex items-start gap-4">
          <UserAvatar pubkey={profile.pubkey} size="md" />
          <div class="flex-1 min-w-0">
            <UserName
              pubkey={profile.pubkey}
              showPubkey={true}
              maxLength={20}
              class="block mb-2"
            />
            {nip05() && (
              <div class="text-base-content/60 text-xs mb-2 font-mono">
                {nip05()}
              </div>
            )}
            {about() && (
              <p class="text-base-content/70 text-sm mb-2 line-clamp-2">
                {about()}
              </p>
            )}
            {website() && (
              <a
                href={website()}
                target="_blank"
                rel="noopener noreferrer"
                class="link link-primary text-sm block truncate"
              >
                {website()}
              </a>
            )}
          </div>
        </div>
      </div>
      <div class="absolute bottom-2 right-2">
        <a
          href={`https://npub.world/${npub()}`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-base-content/50 hover:text-base-content/70 transition-colors"
          title="View on npub.world"
        >
          npub.world
        </a>
      </div>
    </div>
  );
}
