// Privacy Radar — background service worker (MV3).
// Observes every network request the browser makes per tab, classifies each
// against the tracker dataset, detects real fingerprinting via the injected
// content script, and computes the same A–F privacy score as the web app.

import {
  registrableDomain,
  classify,
  score,
  CATEGORY_META,
  isHouseholdName,
} from "./lib/engine.js";

// --- Tracker dataset (fetched once from the packaged file) -----------------
let TRACKERS = {};
const ready = fetch(chrome.runtime.getURL("lib/trackers.json"))
  .then((r) => r.json())
  .then((data) => {
    TRACKERS = data;
  })
  .catch((err) => console.error("[PrivacyRadar] failed to load trackers.json", err));

// --- Per-tab state ----------------------------------------------------------
/**
 * tabId -> {
 *   siteHost, siteDomain, finalUrl, startedAt,
 *   hosts: Map<host, classification>,
 *   cookieKeys: Set<string>,         // distinct third-party Set-Cookie name@domain
 *   fpApis: Set<string>,             // fingerprinting APIs actually invoked on the page
 *   totalRequests, thirdPartyRequests
 * }
 */
const tabs = new Map();

function freshState(siteUrl) {
  const siteHost = hostname(siteUrl);
  return {
    siteHost,
    siteDomain: registrableDomain(siteHost),
    finalUrl: siteUrl || "",
    startedAt: Date.now(),
    hosts: new Map(),
    cookieKeys: new Set(),
    fpApis: new Set(),
    totalRequests: 0,
    thirdPartyRequests: 0,
  };
}

function hostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isHttp(url) {
  return url.startsWith("http://") || url.startsWith("https://");
}

// --- Request capture --------------------------------------------------------
chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (details.tabId < 0 || !isHttp(details.url)) return;
    await ready;

    // A top-level navigation starts a fresh measurement for the tab.
    if (details.type === "main_frame") {
      tabs.set(details.tabId, freshState(details.url));
      updateBadge(details.tabId);
      return;
    }

    const state = tabs.get(details.tabId);
    if (!state) return;

    const host = hostname(details.url);
    if (!host) return;

    state.totalRequests++;
    if (!state.hosts.has(host)) {
      const c = classify(host, state.siteDomain, TRACKERS);
      state.hosts.set(host, c);
    }
    if (state.hosts.get(host).isThirdParty) state.thirdPartyRequests++;

    updateBadge(details.tabId);
  },
  { urls: ["<all_urls>"] },
);

// Update the first-party host once the main document settles (handles redirects).
chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    if (details.type !== "main_frame" || details.tabId < 0) return;
    const state = tabs.get(details.tabId);
    if (!state) return;
    const host = hostname(details.url);
    if (host && host !== state.siteHost) {
      state.siteHost = host;
      state.siteDomain = registrableDomain(host);
    }
    state.finalUrl = details.url;
  },
  { urls: ["<all_urls>"] },
);

// --- Third-party cookie detection (Set-Cookie on cross-site responses) ------
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0 || !isHttp(details.url)) return;
    const state = tabs.get(details.tabId);
    if (!state) return;
    const host = hostname(details.url);
    const domain = registrableDomain(host);
    if (domain === state.siteDomain) return; // first-party cookie, ignore
    for (const h of details.responseHeaders || []) {
      if (h.name.toLowerCase() !== "set-cookie" || !h.value) continue;
      const name = h.value.split("=")[0].trim();
      state.cookieKeys.add(`${name}@${domain}`);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"],
);

// --- Fingerprinting reports from the page (via content-relay) ---------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "fp" && sender.tab && typeof sender.tab.id === "number") {
    const state = tabs.get(sender.tab.id);
    if (state && msg.api) {
      state.fpApis.add(msg.api);
      updateBadge(sender.tab.id);
    }
    return;
  }
  if (msg && msg.type === "getState") {
    const tabId = msg.tabId;
    ready.then(() => sendResponse(summarize(tabId)));
    return true; // async response
  }
});

// --- Cleanup ----------------------------------------------------------------
chrome.tabs.onRemoved.addListener((tabId) => tabs.delete(tabId));

// --- Summary + score --------------------------------------------------------
function summarize(tabId) {
  const state = tabs.get(tabId);
  if (!state) return null;

  const tp = [...state.hosts.values()].filter((c) => c.isThirdParty);
  const entities = new Set(tp.map((c) => c.entity));
  const domains = new Set(tp.map((c) => c.domain));
  const adtech = new Set(tp.filter((c) => CATEGORY_META[c.category]?.adtech).map((c) => c.entity));
  const fpEntities = new Set(tp.filter((c) => c.fingerprinting).map((c) => c.entity));

  const result = score({
    thirdPartyEntities: entities.size,
    thirdPartyDomains: domains.size,
    adtechEntities: adtech.size,
    fingerprintingDetected: state.fpApis.size > 0,
    fingerprintingEntities: fpEntities.size,
    thirdPartyCookies: state.cookieKeys.size,
  });

  // Per-entity rollup for the popup list.
  const byEntity = new Map();
  for (const c of tp) {
    const cur = byEntity.get(c.entity) || {
      entity: c.entity,
      category: c.category,
      requests: 0,
      fingerprinting: false,
      household: isHouseholdName(c.entity),
      domains: new Set(),
    };
    cur.requests++;
    cur.domains.add(c.domain);
    if (c.fingerprinting) cur.fingerprinting = true;
    // Prefer the "loudest" category for display (adtech > anything else).
    if (CATEGORY_META[c.category]?.adtech && !CATEGORY_META[cur.category]?.adtech) {
      cur.category = c.category;
    }
    byEntity.set(c.entity, cur);
  }
  const companies = [...byEntity.values()]
    .map((e) => ({ ...e, domains: e.domains.size }))
    .sort((a, b) => b.requests - a.requests);

  return {
    siteHost: state.siteHost,
    finalUrl: state.finalUrl,
    totalRequests: state.totalRequests,
    thirdPartyRequests: state.thirdPartyRequests,
    thirdPartyEntities: entities.size,
    thirdPartyDomains: domains.size,
    adtechEntities: adtech.size,
    unfamiliarCount: [...entities].filter((e) => !isHouseholdName(e)).length,
    thirdPartyCookies: state.cookieKeys.size,
    fingerprintingApis: [...state.fpApis],
    companies,
    score: result,
    elapsedMs: Date.now() - state.startedAt,
  };
}

// --- Toolbar badge ----------------------------------------------------------
const GRADE_COLOR = { A: "#2ecc71", B: "#8bcf3f", C: "#ffd24d", D: "#ff9f1c", F: "#ff4d4d" };

function updateBadge(tabId) {
  const s = summarize(tabId);
  if (!s) return;
  const grade = s.score.grade;
  chrome.action.setBadgeText({ tabId, text: grade });
  chrome.action.setBadgeBackgroundColor({ tabId, color: GRADE_COLOR[grade] || "#5b6b7f" });
}
