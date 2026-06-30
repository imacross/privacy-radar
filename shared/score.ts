import type { Grade, ScoreResult, ScoreBreakdownItem } from "./types";

export interface ScoreInput {
  thirdPartyEntities: number; // distinct owning companies (third-party)
  thirdPartyDomains: number; // distinct third-party registrable domains
  adtechEntities: number; // distinct ad-tech companies
  fingerprintingDetected: boolean; // a fingerprinting API was actually called
  fingerprintingEntities: number; // distinct fingerprinting-capable companies seen
  thirdPartyCookies: number; // distinct third-party cookies set
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function gradeFor(value: number): Grade {
  if (value >= 85) return "A";
  if (value >= 70) return "B";
  if (value >= 55) return "C";
  if (value >= 40) return "D";
  return "F";
}

/**
 * Transparent 0–100 privacy score. Starts at 100 and removes points per signal,
 * each capped so a single dimension can't dominate. The breakdown is shown to the
 * user so the grade is explainable.
 */
export function score(input: ScoreInput): ScoreResult {
  const breakdown: ScoreBreakdownItem[] = [];
  let value = 100;

  const push = (label: string, delta: number) => {
    if (delta === 0) return;
    breakdown.push({ label, delta });
    value += delta;
  };

  if (input.thirdPartyEntities > 0) {
    const d = -clamp(input.thirdPartyEntities * 8, 0, 50);
    push(`Data goes to ${input.thirdPartyEntities} different companies`, d);
  }

  const extraDomains = Math.max(0, input.thirdPartyDomains - input.thirdPartyEntities);
  if (extraDomains > 0) {
    const d = -clamp(extraDomains * 2, 0, 12);
    push(`${input.thirdPartyDomains} third-party domains`, d);
  }

  if (input.adtechEntities > 0) {
    const d = -clamp(input.adtechEntities * 5, 0, 20);
    push(`${input.adtechEntities} ad-tech companies`, d);
  }

  if (input.fingerprintingDetected) {
    push("Browser fingerprint taken", -15);
  } else if (input.fingerprintingEntities > 0) {
    push(`${input.fingerprintingEntities} fingerprinting-capable trackers`, -8);
  }

  if (input.thirdPartyCookies > 0) {
    const d = -clamp(input.thirdPartyCookies * 3, 0, 15);
    push(`${input.thirdPartyCookies} third-party cookies`, d);
  }

  value = clamp(Math.round(value), 0, 100);
  return { value, grade: gradeFor(value), breakdown };
}
