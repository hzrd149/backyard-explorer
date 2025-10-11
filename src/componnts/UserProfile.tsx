import UserAvatar from "./UserAvatar";
import UserName from "./UserName";
import { npubEncode } from "nostr-tools/nip19";
import { useSearch } from "../context/SearchContext";

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
  const { updateSearch } = useSearch();

  const handleUsernameClick = () => {
    const npub = npubEncode(props.pubkey);
    const currentQuery =
      new URLSearchParams(window.location.search).get("q") || "";
    const trimmedQuery = currentQuery.trim();
    const newTerm = `by:${npub}`;

    if (!trimmedQuery) {
      updateSearch(newTerm);
    } else if (!trimmedQuery.includes(newTerm)) {
      updateSearch(`${trimmedQuery} ${newTerm}`);
    }
  };

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
        onClick={handleUsernameClick}
      />
    </div>
  );
}
