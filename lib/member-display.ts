import type { Profile } from "@/lib/types";

export function getMemberDisplayName(userId: string, profile?: Profile | null) {
  return profile?.display_name || profile?.email?.split("@")[0] || `Member ${userId.slice(0, 6)}`;
}

export function getMemberEmail(profile?: Profile | null) {
  return profile?.email || "Profile unavailable";
}
