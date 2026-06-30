# Privacy Radar 🛰️

> A tool that turns the question **"When you open this site, who's watching you behind the scenes?"** into a visual answer in 5 seconds.

Enter a URL → a real browser (residential proxy + stealth) opens the page, captures **every network request** it makes, classifies each one (advertising / analytics / fingerprinting / social pixel / third-party cookie), and pours them into a **center site → companies it sends data to** flow graph. A particle flows from the edge on every request; you get a live privacy grade (**A–F + 0–100**) and a _"your data goes to N companies, M of which you've never heard of"_ summary. Click a node to see its owner.

Built for the Netlify hackathon; everything runs on Netlify.

## Architecture

```
Browser (EventSource)  ──/api/scan?url=…──►  netlify/functions/scan.ts  (SSE stream)
                                                  │  CaptureProvider seam
   meta / request / fingerprint / cookie / done   │   ├─ local     → @sparticuz/chromium + puppeteer-extra-stealth
   ◄──────────────────────────────────────────────┤   │              + residential proxy (rotating) + fingerprint hooks
                                                  │   └─ crawlsnap  → POST .../harvest (real headed Chrome) → replay
   shared/classify.ts (+ data/trackers.json) → domain → company / category
   shared/score.ts                            → A–F + 0–100 + breakdown
```

- **local** (default): the browser runs inside the Netlify function, `--headless=new`, always via the residential proxy. ~9s budget, live stream.
- **crawlsnap**: delegates to the already-deployed `crawlsnap-browser` `/harvest` engine (full stealth). Since a harvest can take 10–45s, it exceeds Netlify's ~10s sync limit — use it under `netlify dev` or in an environment with a raised timeout.

## Setup

```bash
npm install
cp .env.example .env     # fill in your real proxy / crawlsnap values
```

`.env` (gitignored):

| variable | description |
|---|---|
| `CAPTURE_PROVIDER` | `local` (default) or `crawlsnap` |
| `PROXY_HOST/PORT/USERNAME/PASSWORD` | residential proxy, always used (rotating endpoint, port 823 — never sticky) |
| `CRAWLSNAP_HARVEST_URL/API_KEY` | for the crawlsnap provider |
| `CHROME_PATH` | local dev only (macOS) — system Chrome path |

> On macOS the `local` provider needs the system Chrome (the `@sparticuz` binary is Linux/Lambda-specific). Set `CHROME_PATH` in `.env`. The easiest end-to-end test on macOS: `CAPTURE_PROVIDER=crawlsnap`.

## Running

```bash
npm run dev        # netlify dev — frontend + /api/scan function together
# http://localhost:8888
```

Proxy test:

```bash
curl -x "http://$PROXY_USERNAME:$PROXY_PASSWORD@proxy.crawlsnap.com:823" https://api.ipify.org
```

## Deploy (Netlify)

1. Connect the repo to Netlify (build: `npm run build`, publish: `dist`).
2. Enter the values from `.env` into the site env vars.
3. Publish — the `/api/scan` streaming function is set up automatically.

## Notes / limits

- Netlify free sync functions are ~10s; the `local` provider fits within this via a hard 9s cap + partial streaming.
- `@sparticuz/chromium` + the stealth plugin are marked as `external_node_modules` in `netlify.toml` (to work around esbuild's binary + dynamic-require issues).
- Tracker catalog: `data/trackers.json` (~150 top trackers, domain→company→category). Add new domains to extend it.
