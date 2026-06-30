import type { CaptureProvider } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Switchable engine: delegate to the already-deployed crawlsnap-browser /harvest
 * endpoint (real headed Chrome + residential + warm cookies, full stealth). It
 * returns the whole capture as one JSON batch, which we replay as a staggered
 * stream so the live particle animation still flows.
 *
 * Note: a real headed harvest can take 10–45s, which exceeds Netlify's ~10s sync
 * timeout on the free tier — use this provider in `netlify dev` or where the
 * function timeout is raised. The `local` provider is the one that fits 10s.
 */
export const crawlsnapProvider: CaptureProvider = {
  name: "crawlsnap",
  async capture(url, hooks, opts) {
    const endpoint = process.env.CRAWLSNAP_HARVEST_URL;
    const apiKey = process.env.CRAWLSNAP_API_KEY ?? "";
    if (!endpoint) throw new Error("CRAWLSNAP_HARVEST_URL is not set");

    hooks.onStatus("info", "Opening the site in a real browser…");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({
        url,
        include_bodies: false,
        timeout: Math.floor(opts.deadlineMs / 1000),
      }),
      signal: opts.signal,
    });

    if (!res.ok) throw new Error(`harvest ${res.status} ${res.statusText}`);
    const data: any = await res.json();

    hooks.onSiteResolved(data.final_url || url, data.title ?? null);
    const reqs: any[] = Array.isArray(data.requests) ? data.requests : [];
    hooks.onStatus("info", `Watched ${data.stats?.totalRequests ?? reqs.length} network connections — analyzing who's tracking you…`);

    const stagger = reqs.length > 0 ? Math.min(40, Math.max(8, Math.floor(2500 / reqs.length))) : 0;
    for (const r of reqs) {
      if (opts.signal.aborted) break;
      if (r?.url) {
        hooks.onRequest({ url: r.url, resourceType: String(r.resourceType ?? "other").toLowerCase() });
      }
      if (stagger) await sleep(stagger);
    }

    const cookies: any[] = Array.isArray(data.cookies) ? data.cookies : [];
    for (const c of cookies) {
      if (c?.name && c?.domain) hooks.onCookie({ name: c.name, domain: c.domain });
    }
  },
};
