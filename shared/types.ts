// Shared vocabulary between the capture function and the React frontend.

export type TrackerCategory =
  | "advertising"
  | "analytics"
  | "fingerprinting"
  | "social"
  | "session-replay"
  | "tag-manager"
  | "consent"
  | "customer-interaction"
  | "cdn"
  | "essential"
  | "unknown";

/** Result of classifying a single request host. */
export interface Classification {
  host: string; // full hostname of the request
  domain: string; // registrable domain (eTLD+1)
  entity: string; // owning company, e.g. "Google"
  category: TrackerCategory;
  isThirdParty: boolean;
  fingerprinting: boolean; // owning entity is fingerprinting-capable
  known: boolean; // matched a known tracker entry
}

export interface RequestEventData extends Classification {
  url: string;
  resourceType: string;
}

export interface ScoreBreakdownItem {
  label: string;
  delta: number; // negative number, points removed
}

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface ScoreResult {
  value: number; // 0–100
  grade: Grade;
  breakdown: ScoreBreakdownItem[];
}

export interface ScanSummary {
  siteHost: string;
  finalUrl: string;
  title: string | null;
  totalRequests: number;
  thirdPartyRequests: number;
  thirdPartyDomains: number;
  entities: string[]; // distinct third-party owning companies
  unfamiliarCount: number; // entities that are not household names ("never heard of")
  knownTrackerRequests: number;
  thirdPartyCookies: number;
  fingerprintingApis: string[];
  score: ScoreResult;
  provider: string;
  elapsedMs: number;
}

/** Server-sent events streamed from /api/scan. */
export type ScanEvent =
  | { type: "meta"; siteHost: string; provider: string; startedAt: number }
  | { type: "status"; level: "info" | "warn" | "error"; message: string }
  | { type: "request"; req: RequestEventData }
  | { type: "fingerprint"; api: string; script?: string }
  | {
      type: "cookie";
      name: string;
      domain: string;
      entity: string;
      isThirdParty: boolean;
    }
  | { type: "done"; summary: ScanSummary }
  | { type: "error"; message: string };
