import type { SafeAreaProfile } from "../schemas";

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SafeAreaConfig {
  id: SafeAreaProfile;
  name: string;
  description: string;
  insets: SafeAreaInsets;
  captionBottomOffset: number;
}

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

export const safeAreaProfiles: Record<SafeAreaProfile, SafeAreaConfig> = {
  universal: {
    id: "universal",
    name: "Universal",
    description: "Safe for all platforms",
    insets: { top: 100, bottom: 340, left: 60, right: 60 },
    captionBottomOffset: 80,
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    description: "Optimized for TikTok's UI overlay",
    insets: { top: 120, bottom: 350, left: 60, right: 60 },
    captionBottomOffset: 80,
  },
  instagram_reels: {
    id: "instagram_reels",
    name: "Instagram Reels",
    description: "Optimized for Reels UI overlay",
    insets: { top: 100, bottom: 330, left: 60, right: 60 },
    captionBottomOffset: 70,
  },
  youtube_shorts: {
    id: "youtube_shorts",
    name: "YouTube Shorts",
    description: "Optimized for Shorts UI overlay",
    insets: { top: 80, bottom: 280, left: 60, right: 60 },
    captionBottomOffset: 60,
  },
};

export function getSafeAreaConfig(profileId: SafeAreaProfile): SafeAreaConfig {
  return safeAreaProfiles[profileId] || safeAreaProfiles.universal;
}

export function getCaptionSafeY(
  profileId: SafeAreaProfile, 
  videoHeight: number = BASE_HEIGHT
): number {
  const config = getSafeAreaConfig(profileId);
  const scale = videoHeight / BASE_HEIGHT;
  return videoHeight - (config.insets.bottom * scale) + (config.captionBottomOffset * scale);
}

export function getCaptionMaxWidth(
  profileId: SafeAreaProfile, 
  videoWidth: number = BASE_WIDTH
): number {
  const config = getSafeAreaConfig(profileId);
  const scale = videoWidth / BASE_WIDTH;
  return videoWidth - (config.insets.left * scale) - (config.insets.right * scale);
}
