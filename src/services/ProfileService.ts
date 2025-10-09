interface ProfileData {
  display_name?: string;
  name?: string;
  picture?: string;
  about?: string;
  website?: string;
}

// Cache for profile data
const profileCache = new Map<string, ProfileData | null>();

// Fetch profile data for a given pubkey
export async function fetchProfile(
  pubkey: string,
): Promise<ProfileData | null> {
  // Check cache first
  if (profileCache.has(pubkey)) {
    return profileCache.get(pubkey)!;
  }

  try {
    const db = window.nostrdb;
    if (!db) {
      console.warn("NostrDB not available");
      return null;
    }

    // Get the latest profile event (kind 0) for this pubkey
    const profile = await db.replaceable(0, pubkey);

    if (!profile) {
      profileCache.set(pubkey, null);
      return null;
    }

    // Parse the profile content
    let profileData: ProfileData = {};
    try {
      profileData = JSON.parse(profile.content);
    } catch (error) {
      console.warn("Failed to parse profile data for", pubkey, error);
      profileCache.set(pubkey, null);
      return null;
    }

    // Cache the result
    profileCache.set(pubkey, profileData);
    return profileData;
  } catch (error) {
    console.error("Failed to fetch profile for", pubkey, error);
    profileCache.set(pubkey, null);
    return null;
  }
}

export {
  getProfilePicture,
  getDisplayName,
} from "applesauce-core/helpers/profile";

// Clear profile cache (useful for testing or when profiles are updated)
export function clearProfileCache(): void {
  profileCache.clear();
}

// Clear specific profile from cache
export function clearProfileFromCache(pubkey: string): void {
  profileCache.delete(pubkey);
}
