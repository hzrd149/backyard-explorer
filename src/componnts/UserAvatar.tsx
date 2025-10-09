import { createEffect, createSignal } from "solid-js";
import { fetchProfile, getProfilePicture } from "../services/ProfileService";

interface UserAvatarProps {
  pubkey: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  class?: string;
}

export default function UserAvatar(props: UserAvatarProps) {
  const [profilePicture, setProfilePicture] = createSignal<string>();
  const [isLoading, setIsLoading] = createSignal(true);
  const [hasError, setHasError] = createSignal(false);

  createEffect(async () => {
    setIsLoading(true);
    setHasError(false);

    try {
      const profile = await fetchProfile(props.pubkey);
      const picture = getProfilePicture(profile ?? undefined);
      setProfilePicture(picture);
    } catch (error) {
      console.error("Failed to load avatar for", props.pubkey, error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  });

  const getSizeClasses = () => {
    switch (props.size) {
      case "xs":
        return "w-6 h-6";
      case "sm":
        return "w-8 h-8";
      case "md":
        return "w-12 h-12";
      case "lg":
        return "w-16 h-16";
      case "xl":
        return "w-20 h-20";
      default:
        return "w-12 h-12";
    }
  };

  const getInitials = () => {
    // Use first 2 characters of pubkey as fallback
    return props.pubkey.slice(0, 2).toUpperCase();
  };

  return (
    <div class={`avatar ${getSizeClasses()} ${props.class || ""}`}>
      <div class="rounded-full bg-base-300 flex items-center justify-center">
        {isLoading() ? (
          <span class="loading loading-spinner loading-sm"></span>
        ) : hasError() || !profilePicture() ? (
          <div class="text-base-content/70 font-mono text-xs">
            {getInitials()}
          </div>
        ) : (
          <img
            src={profilePicture()!}
            alt={`Avatar for ${props.pubkey.slice(0, 8)}...`}
            class="w-full h-full object-cover rounded-full"
            onError={() => setHasError(true)}
          />
        )}
      </div>
    </div>
  );
}
