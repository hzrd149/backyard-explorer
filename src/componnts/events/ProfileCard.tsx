import type { NostrEvent } from "nostr-tools";
import UserAvatar from "../UserAvatar";
import UserName from "../UserName";

interface ProfileCardProps {
  profile: NostrEvent;
}

export default function ProfileCard(props: ProfileCardProps) {
  const profileData = () => {
    try {
      return JSON.parse(props.profile.content);
    } catch {
      return {};
    }
  };

  const about = () => profileData().about || "";
  const website = () => profileData().website || "";

  return (
    <div class="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        <div class="flex items-start gap-4">
          <UserAvatar pubkey={props.profile.pubkey} size="md" />
          <div class="flex-1 min-w-0">
            <UserName
              pubkey={props.profile.pubkey}
              showPubkey={true}
              maxLength={20}
              class="block mb-2"
            />
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
    </div>
  );
}
