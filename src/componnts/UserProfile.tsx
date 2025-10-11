import UserAvatar from "./UserAvatar";
import UserName from "./UserName";

interface UserProfileProps {
  pubkey: string;
  avatarSize?: "xs" | "sm" | "md" | "lg" | "xl";
  showPubkey?: boolean;
  maxNameLength?: number;
  class?: string;
  avatarClass?: string;
  nameClass?: string;
}

export default function UserProfile(props: UserProfileProps) {
  return (
    <div class={`flex items-center gap-3 ${props.class || ""}`}>
      <UserAvatar
        pubkey={props.pubkey}
        size={props.avatarSize || "md"}
        class={props.avatarClass}
      />
      <UserName
        pubkey={props.pubkey}
        showPubkey={props.showPubkey}
        maxLength={props.maxNameLength}
        class={props.nameClass}
      />
    </div>
  );
}
