// Privacy Radar — classification + scoring engine.
// This is a hand-ported, dependency-free copy of the project's shared/ logic
// (psl.ts, classify.ts, score.ts, categories.ts) so the extension can run the
// exact same grading the web app does, entirely in the browser.

// ---------------------------------------------------------------------------
// Registrable domain (eTLD+1) — mirror of shared/psl.ts
// ---------------------------------------------------------------------------
const MULTI_LABEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "sch.uk", "ac.uk", "gov.uk", "nhs.uk",
  "com.tr", "net.tr", "org.tr", "gov.tr", "edu.tr", "web.tr", "gen.tr", "av.tr", "bel.tr", "k12.tr",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au", "co.nz", "net.nz", "org.nz", "govt.nz",
  "co.jp", "ne.jp", "or.jp", "go.jp", "ac.jp", "ad.jp", "co.kr", "or.kr", "ne.kr", "go.kr",
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn",
  "com.br", "net.br", "org.br", "gov.br", "com.mx", "org.mx", "gob.mx", "com.ar", "gob.ar",
  "co.in", "net.in", "org.in", "gov.in", "firm.in", "gen.in",
  "co.za", "org.za", "gov.za", "com.sg", "com.hk", "com.ru", "co.il", "com.ua", "com.pl",
  "com.es", "com.de", "co.id", "com.my", "com.ph", "com.vn", "com.sa", "com.tw", "co.th",
]);

export function registrableDomain(host) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) return parts.slice(-3).join(".");
  return lastTwo;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Categories — mirror of shared/categories.ts
// ---------------------------------------------------------------------------
export const CATEGORY_META = {
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

// ---------------------------------------------------------------------------
// Classification — mirror of shared/classify.ts (TRACKERS injected, not bundled)
// ---------------------------------------------------------------------------
export function classify(host, siteDomain, TRACKERS) {
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

const HOUSEHOLD_NAMES = new Set([
  "Google", "Meta", "Amazon", "Microsoft", "Adobe", "Apple", "TikTok",
  "X (Twitter)", "Pinterest", "Snap", "Reddit", "Cloudflare", "Yandex",
  "Salesforce", "HubSpot", "Automattic", "Mailchimp",
]);

export function isHouseholdName(entity) {
  return HOUSEHOLD_NAMES.has(entity);
}

// ---------------------------------------------------------------------------
// Score — mirror of shared/score.ts
// ---------------------------------------------------------------------------
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function gradeFor(value) {
  if (value >= 85) return "A";
  if (value >= 70) return "B";
  if (value >= 55) return "C";
  if (value >= 40) return "D";
  return "F";
}

export function score(input) {
  const breakdown = [];
  let value = 100;

  const push = (label, delta) => {
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
