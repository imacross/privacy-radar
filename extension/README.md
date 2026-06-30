# Privacy Radar — browser extension

A Manifest V3 Chrome/Edge extension that scores the privacy of **whatever site
you're on**, live, without sending anything to a server. It watches the network
requests your browser actually makes, traces each one to the company behind it
using the same tracker dataset as the Privacy Radar web app, detects real
browser-fingerprinting attempts in the page, and grades the site from **A to F**.

## How it works

- `background.js` — service worker. Listens to `chrome.webRequest` per tab,
  classifies every request host (ad networks, analytics, fingerprinting, social,
  …), counts third-party `Set-Cookie` headers, and computes the score.
- `content-fp.js` — runs in the page's MAIN world at `document_start` and wraps
  canvas/WebGL/audio fingerprinting APIs so we know when they're *actually* used.
- `content-relay.js` — bridges those page-world signals to the service worker.
- `popup.html` / `popup.js` — the A–F grade, the score breakdown, and the list
  of companies watching you on the current page.
- `lib/engine.js` — a dependency-free port of the web app's `shared/` logic.
- `lib/trackers.json` — the tracker dataset (copied from `data/trackers.json`).

The toolbar badge always shows the current page's grade.

## Install (Load unpacked)

1. Unzip the download.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the unzipped folder.
5. Open any website and click the Privacy Radar icon.

> 100% local — no data leaves your browser. Reload a tab after installing so the
> extension can observe its requests from the start.

## Rebuilding the download

From the repo root: `npm run build:extension` — this copies the latest
`data/trackers.json` in, regenerates the icons (needs Chrome locally), and writes
`public/privacy-radar-extension.zip` that the landing page links to.
