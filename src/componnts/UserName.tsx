import { createSignal, createEffect } from "solid-js";
import { fetchProfile, getDisplayName } from "../services/ProfileService";
import { npubEncode } from "nostr-tools/nip19";

interface UserNameProps {
  pubkey: string;
  showPubkey?: boolean;
  maxLength?: number;
  class?: string;
}

export default function UserName(props: UserNameProps) {
  const [displayName, setDisplayName] = createSignal<string>();
  const [isLoading, setIsLoading] = createSignal(true);
  const [hasError, setHasError] = createSignal(false);

  createEffect(async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const profile = await fetchProfile(props.pubkey);
      const name = getDisplayName(
        profile ?? undefined,
        npubEncode(props.pubkey),
      );
      setDisplayName(name ?? "");
    } catch (error) {
      console.error("Failed to load name for", props.pubkey, error);
      setHasError(true);
      setDisplayName("Unknown");
    } finally {
      setIsLoading(false);
    }
  });

  const getFallbackName = () => {
    // Use first 8 characters of pubkey as fallback
    return `${props.pubkey.slice(0, 8)}...`;
  };

  const getDisplayText = () => {
    if (isLoading()) return "Loading...";
    if (hasError()) return getFallbackName();

    let name = displayName();

    // Truncate if maxLength is specified
    if (props.maxLength && name && name.length > props.maxLength) {
      name = name.slice(0, props.maxLength) + "...";
    }

    return name;
  };

  const getPubkeyText = () => {
    if (props.showPubkey) {
      return (
        <span class="text-base-content/50 text-xs font-mono ml-2">
          {props.pubkey.slice(0, 8)}...
        </span>
      );
    }
    return null;
  };

  return (
    <span class={props.class || ""}>
      <span class={isLoading() ? "text-base-content/50" : ""}>
        {getDisplayText()}
      </span>
      {getPubkeyText()}
    </span>
  );
}
