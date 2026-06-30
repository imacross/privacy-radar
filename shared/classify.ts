import type { Classification, TrackerCategory } from "./types";
import { registrableDomain } from "./psl";
import trackersRaw from "../data/trackers.json";

interface TrackerEntry {
  owner: string;
  category: TrackerCategory;
  fingerprinting?: boolean;
}

const TRACKERS = trackersRaw as Record<string, TrackerEntry>;

/**
 * Classify a request host relative to the first-party site host.
 * Matching is by registrable domain so subdomains (e.g. analytics.tiktok.com)
 * resolve to their owning entry (tiktok.com).
 */
export function classify(host: string, siteDomain: string): Classification {
  const domain = registrableDomain(host);
  const isThirdParty = domain !== siteDomain;
  const entry = TRACKERS[domain];

  if (entry) {
    return {
      host,
      domain,
      entity: entry.owner,
      category: entry.category,
      isThirdParty,
      fingerprinting: Boolean(entry.fingerprinting),
      known: true,
    };
  }

  return {
    host,
    domain,
    entity: domain,
    category: isThirdParty ? "unknown" : "essential",
    isThirdParty,
    fingerprinting: false,
    known: false,
  };
}

/** Entities most people recognize — used for the "…you've never heard of" shock line. */
const HOUSEHOLD_NAMES = new Set([
  "Google", "Meta", "Amazon", "Microsoft", "Adobe", "Apple", "TikTok",
  "X (Twitter)", "Pinterest", "Snap", "Reddit", "Cloudflare", "Yandex",
  "Salesforce", "HubSpot", "Automattic", "Mailchimp",
]);

export function isHouseholdName(entity: string): boolean {
  return HOUSEHOLD_NAMES.has(entity);
}
