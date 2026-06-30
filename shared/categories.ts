import type { TrackerCategory } from "./types";

export interface CategoryMeta {
  label: string; // display label
  short: string; // short English key for the node badge
  color: string; // node / edge color
  adtech: boolean; // counts as ad-tech for scoring
}

export const CATEGORY_META: Record<TrackerCategory, CategoryMeta> = {
  advertising: { label: "Ad network", short: "ads", color: "#ff4d4d", adtech: true },
  analytics: { label: "Analytics", short: "analytics", color: "#ff9f1c", adtech: false },
  fingerprinting: { label: "Fingerprinting", short: "fingerprint", color: "#c44dff", adtech: false },
  social: { label: "Social media pixel", short: "social", color: "#4d8bff", adtech: true },
  "session-replay": { label: "Session replay", short: "replay", color: "#ff4dd2", adtech: false },
  "tag-manager": { label: "Tag manager", short: "tag", color: "#ffd24d", adtech: false },
  consent: { label: "Cookie consent (CMP)", short: "consent", color: "#2ec4b6", adtech: false },
  "customer-interaction": { label: "Chat/support", short: "chat", color: "#4dd07a", adtech: false },
  cdn: { label: "CDN / infrastructure", short: "cdn", color: "#8a94a6", adtech: false },
  essential: { label: "Essential/functional", short: "essential", color: "#6b7a8f", adtech: false },
  unknown: { label: "Unknown third party", short: "unknown", color: "#5b6b7f", adtech: false },
};

export const FIRST_PARTY_COLOR = "#00e0a4";
