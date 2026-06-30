#!/usr/bin/env node
// Build data/trackers.json by merging DuckDuckGo's Tracker Radar dataset
// (https://github.com/duckduckgo/tracker-radar) with our hand-curated
// data/trackers.overrides.json. Overrides always win.
//
// Usage:
//   node scripts/build-trackers.mjs            # sparse-clones tracker-radar into .cache/ if absent
//   TR_RADAR_DIR=/path/to/tracker-radar node scripts/build-trackers.mjs
//
// Tracker Radar ships one JSON per domain under domains/<region>/<domain>.json,
// each with: owner.displayName, categories[] (DDG's ~25-category taxonomy),
// and fingerprinting (0=none .. 3=high). We collapse the multi-category list
// to our single TrackerCategory by priority, and derive our boolean
// `fingerprinting` from the numeric score (>= 2).

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = path.join(ROOT, ".cache", "tracker-radar");
const OUT = path.join(ROOT, "data", "trackers.json");
const OVERRIDES = path.join(ROOT, "data", "trackers.overrides.json");
const REGION = process.env.TR_RADAR_REGION || "US";
const REPO = "https://github.com/duckduckgo/tracker-radar.git";

// --- DDG category -> our TrackerCategory, with collapse priority -----------
// A domain may carry several DDG categories; we keep the highest-priority one.
// Lower number = higher priority.
const CATEGORY_MAP = {
  // advertising
  "Advertising": ["advertising", 1],
  "Ad Motivated Tracking": ["advertising", 1],
  "Ad Fraud": ["advertising", 1],
  "Action Pixels": ["advertising", 1],
  // social
  "Social Network": ["social", 2],
  "Social - Share": ["social", 2],
  "Social - Comment": ["social", 2],
  "Badge": ["social", 2],
  // session replay
  "Session Replay": ["session-replay", 3],
  // analytics
  "Analytics": ["analytics", 4],
  "Third-Party Analytics Marketing": ["analytics", 4],
  "Audience Measurement": ["analytics", 4],
  // tag manager
  "Tag Manager": ["tag-manager", 5],
  // consent
  "Consent Management Platform": ["consent", 6],
  // customer interaction
  "Support Chat Widget": ["customer-interaction", 7],
  // cdn / infrastructure / embeds
  "CDN": ["cdn", 8],
  "Embedded Content": ["cdn", 8],
  // functional / not privacy-harmful -> essential
  "Online Payment": ["essential", 9],
  "Federated Login": ["essential", 9],
  "SSO": ["essential", 9],
  "Fraud Prevention": ["essential", 9],
  "Non-Tracking": ["essential", 9],
};

function collapseCategory(ddgCategories, fingerprintScore) {
  let best = null;
  let bestPriority = Infinity;
  for (const c of ddgCategories || []) {
    const hit = CATEGORY_MAP[c];
    if (hit && hit[1] < bestPriority) {
      best = hit[0];
      bestPriority = hit[1];
    }
  }
  if (best) return best;
  // No mapped category: a high fingerprinting score is the strongest signal we have.
  if (fingerprintScore >= 3) return "fingerprinting";
  return "unknown";
}

function ensureDataset() {
  if (process.env.TR_RADAR_DIR) return process.env.TR_RADAR_DIR;
  if (fs.existsSync(path.join(CACHE_DIR, "domains", REGION))) return CACHE_DIR;

  console.log("Sparse-cloning tracker-radar into .cache/ (first run only)...");
  fs.mkdirSync(path.dirname(CACHE_DIR), { recursive: true });
  fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  execSync(
    `git clone --depth 1 --filter=blob:none --sparse ${REPO} "${CACHE_DIR}"`,
    { stdio: "inherit" },
  );
  execSync(`git -C "${CACHE_DIR}" sparse-checkout set domains/${REGION}`, {
    stdio: "inherit",
  });
  return CACHE_DIR;
}

function main() {
  const dir = ensureDataset();
  const domainsDir = path.join(dir, "domains", REGION);
  if (!fs.existsSync(domainsDir)) {
    console.error(`No domains found at ${domainsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(domainsDir).filter((f) => f.endsWith(".json"));
  const out = {};
  let skipped = 0;

  for (const file of files) {
    let d;
    try {
      d = JSON.parse(fs.readFileSync(path.join(domainsDir, file), "utf8"));
    } catch {
      skipped++;
      continue;
    }
    const domain = d.domain;
    if (!domain) {
      skipped++;
      continue;
    }
    const owner = d.owner?.displayName || d.owner?.name;
    const fp = Number(d.fingerprinting) || 0;
    const categories = d.categories || [];

    // Pure noise: no owner, no category, no fingerprinting -> classify already
    // treats these as "unknown third party", so an entry adds nothing.
    if (!owner && categories.length === 0 && fp === 0) {
      skipped++;
      continue;
    }

    const entry = {
      owner: owner || domain,
      category: collapseCategory(categories, fp),
    };
    if (fp >= 2) entry.fingerprinting = true;
    out[domain] = entry;
  }

  // Hand-curated overrides win over generated data.
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES, "utf8"));
  let overridden = 0;
  for (const [domain, entry] of Object.entries(overrides)) {
    if (out[domain]) overridden++;
    out[domain] = entry;
  }

  // Stable, compact serialization: one line per domain, sorted alphabetically.
  const keys = Object.keys(out).sort();
  const lines = keys.map(
    (k) => `  ${JSON.stringify(k)}: ${JSON.stringify(out[k])}`,
  );
  fs.writeFileSync(OUT, `{\n${lines.join(",\n")}\n}\n`);

  console.log(
    `Wrote ${keys.length} trackers -> ${path.relative(ROOT, OUT)}`,
  );
  console.log(
    `  ${Object.keys(overrides).length} overrides applied (${overridden} replaced generated entries)`,
  );
  console.log(`  ${skipped} source files skipped (no usable signal)`);
}

main();
