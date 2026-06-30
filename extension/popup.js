import { CATEGORY_META } from "./lib/engine.js";

// The deployed web app — used for the "deep scan" link. Override at build time
// if the production URL differs.
const WEB_APP = "https://privacy-radar.netlify.app";

const GRADE_COLOR = { A: "#2ecc71", B: "#8bcf3f", C: "#ffd24d", D: "#ff9f1c", F: "#ff4d4d" };

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

async function load() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  $("deep").href = tab.url ? `${WEB_APP}/?url=${encodeURIComponent(tab.url)}` : WEB_APP;

  const data = await chrome.runtime.sendMessage({ type: "getState", tabId: tab.id });
  render(data, tab);
}

function render(data, tab) {
  const content = $("content");
  content.innerHTML = "";

  if (!data || !data.siteHost) {
    const m = el("div", "pr-empty");
    m.innerHTML =
      "No data for this tab yet.<br><small>Open or reload a normal website (http/https) and try again — internal pages like the new-tab page can't be measured.</small>";
    content.appendChild(m);
    return;
  }

  $("host").textContent = data.siteHost;
  $("elapsed").textContent = `${data.totalRequests} requests · ${data.thirdPartyRequests} third-party`;

  // --- Score hero ---
  const s = data.score;
  const hero = el("section", "pr-hero");
  const ring = el("div", "pr-grade");
  ring.style.setProperty("--c", GRADE_COLOR[s.grade] || "#5b6b7f");
  ring.style.setProperty("--p", `${s.value}%`);
  const gi = el("div", "pr-grade-inner");
  gi.appendChild(el("span", "pr-letter", s.grade));
  gi.appendChild(el("span", "pr-num", String(s.value)));
  ring.appendChild(gi);
  hero.appendChild(ring);

  const facts = el("div", "pr-facts");
  facts.appendChild(fact(data.thirdPartyEntities, "companies get your data"));
  facts.appendChild(fact(data.unfamiliarCount, "you've never heard of"));
  facts.appendChild(fact(data.thirdPartyCookies, "third-party cookies"));
  hero.appendChild(facts);
  content.appendChild(hero);

  // --- Fingerprint alert ---
  if (data.fingerprintingApis.length) {
    const fp = el("div", "pr-fp");
    fp.appendChild(el("b", null, "🫆 Browser fingerprint taken"));
    fp.appendChild(el("span", null, data.fingerprintingApis.join(" · ")));
    content.appendChild(fp);
  }

  // --- Score breakdown ---
  if (s.breakdown.length) {
    const bd = el("ul", "pr-breakdown");
    for (const b of s.breakdown) {
      const li = el("li");
      li.appendChild(el("span", "pr-bd-label", b.label));
      li.appendChild(el("span", "pr-bd-delta", String(b.delta)));
      bd.appendChild(li);
    }
    content.appendChild(bd);
  }

  // --- Companies ---
  if (data.companies.length) {
    content.appendChild(el("h3", "pr-h3", "Who's watching"));
    const list = el("ul", "pr-companies");
    for (const c of data.companies) {
      const meta = CATEGORY_META[c.category] || CATEGORY_META.unknown;
      const li = el("li");
      const dot = el("span", "pr-dot");
      dot.style.background = meta.color;
      li.appendChild(dot);
      const name = el("span", "pr-co-name", c.entity);
      if (c.fingerprinting) name.appendChild(el("span", "pr-tag-fp", "fp"));
      li.appendChild(name);
      li.appendChild(el("span", "pr-co-cat", meta.label));
      li.appendChild(el("span", "pr-co-n", `${c.requests}×`));
      list.appendChild(li);
    }
    content.appendChild(list);
  } else {
    const ok = el("div", "pr-empty");
    ok.innerHTML = "🛡️ No third-party trackers detected on this page. Clean!";
    content.appendChild(ok);
  }
}

function fact(n, label) {
  const f = el("div", "pr-fact");
  f.appendChild(el("b", null, String(n)));
  f.appendChild(el("span", null, label));
  return f;
}

load();
