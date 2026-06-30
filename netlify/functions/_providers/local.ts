import { platform } from "node:os";
import type { CaptureProvider } from "./types";
import { residentialProxy } from "../_lib/proxy";
import { FP_HOOK_SOURCE } from "../_lib/fingerprint";

const isLambda = !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

function devChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const p = platform();
  if (p === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (p === "win32") return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  return "/usr/bin/google-chrome";
}

// Best-effort: dismiss a cookie/consent wall so third-party trackers actually
// fire (many sites gate them behind TCF consent). Runs in the page context.
function acceptConsent(): boolean {
  const selectors = [
    "#onetrust-accept-btn-handler",
    "#truste-consent-button",
    "#didomi-notice-agree-button",
    '[data-testid="uc-accept-all-button"]',
    'button[aria-label*="accept" i]',
    'button[aria-label*="agree" i]',
    ".cookie-accept",
  ];
  for (const s of selectors) {
    const el = document.querySelector(s) as HTMLElement | null;
    if (el) {
      el.click();
      return true;
    }
  }
  // Exact-match only, and only real buttons — never <a> links (would navigate away).
  const texts = new Set([
    "accept all", "accept all cookies", "accept", "i accept", "agree", "i agree",
    "allow all", "got it", "tümünü kabul et", "kabul et", "kabul ediyorum", "onayla",
  ]);
  const nodes = Array.from(document.querySelectorAll('button, [role="button"]')) as HTMLElement[];
  for (const b of nodes) {
    const t = (b.textContent || "").trim().toLowerCase();
    if (t && texts.has(t)) {
      b.click();
      return true;
    }
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Default engine: real Chrome on the Netlify function via @sparticuz/chromium
 * (new headless) + puppeteer-extra-stealth, always behind the residential proxy.
 * In local dev (non-Lambda) it falls back to the system Chrome, since the
 * @sparticuz binary only runs on Amazon Linux.
 */
export const localProvider: CaptureProvider = {
  name: "local",
  async capture(url, hooks, opts) {
    const { addExtra } = await import("puppeteer-extra");
    const puppeteerCore = (await import("puppeteer-core")).default as unknown as any;
    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default as unknown as any;

    const puppeteer = addExtra(puppeteerCore);
    puppeteer.use(StealthPlugin());

    const proxy = residentialProxy();
    const args: string[] = [];
    let executablePath: string;

    if (isLambda) {
      const chromium = (await import("@sparticuz/chromium")).default as unknown as any;
      args.push(...chromium.args);
      executablePath = await chromium.executablePath();
    } else {
      executablePath = devChromePath();
      args.push("--no-sandbox", "--disable-setuid-sandbox");
    }
    args.push("--disable-blink-features=AutomationControlled");
    if (proxy) args.push(`--proxy-server=${proxy.server}`);

    hooks.onStatus("info", "Visiting the site as a real, private visitor…");

    const browser = await puppeteer.launch({
      args,
      executablePath,
      headless: true, // new headless (NOT "shell") for stealth
      defaultViewport: { width: 1366, height: 768 },
      acceptInsecureCerts: true,
    });

    const onAbort = () => {
      browser.close().catch(() => {});
    };
    opts.signal.addEventListener("abort", onAbort, { once: true });

    const hardDeadline = Date.now() + opts.deadlineMs;

    try {
      const page = await browser.newPage();
      if (proxy) await page.authenticate({ username: proxy.username, password: proxy.password });

      await page.exposeFunction("__fpReport", (api: string) => {
        try {
          hooks.onFingerprint(String(api));
        } catch {
          /* ignore */
        }
      });
      await page.evaluateOnNewDocument(FP_HOOK_SOURCE);

      page.on("request", (r: any) => {
        try {
          hooks.onRequest({ url: r.url(), resourceType: r.resourceType() });
        } catch {
          /* ignore */
        }
      });

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: Math.max(3000, opts.deadlineMs - 1500) });
      } catch {
        hooks.onStatus("warn", "Continuing before the page fully loaded.");
      }

      // Unlock consent-gated trackers.
      try {
        const clicked = await page.evaluate(acceptConsent);
        if (clicked) hooks.onStatus("info", "Cookie consent accepted — loading trackers…");
      } catch {
        /* ignore */
      }

      // Keep capturing late / lazy-loaded trackers, scrolling, until we must
      // stop to harvest cookies before the hard deadline.
      const settleUntil = hardDeadline - 1500;
      let y = 0;
      while (Date.now() < settleUntil && !opts.signal.aborted) {
        try {
          y += 1400;
          await page.evaluate((yy: number) => window.scrollTo(0, yy), y);
        } catch {
          /* ignore */
        }
        await sleep(600);
      }

      if (!opts.signal.aborted) {
        const finalUrl = page.url();
        let title: string | null = null;
        try {
          title = await page.title();
        } catch {
          /* ignore */
        }
        hooks.onSiteResolved(finalUrl, title);

        try {
          const client = await page.target().createCDPSession();
          const res = (await client.send("Network.getAllCookies")) as { cookies?: any[] };
          for (const c of res.cookies ?? []) {
            hooks.onCookie({ name: c.name, domain: c.domain });
          }
        } catch {
          /* ignore */
        }
      }
    } finally {
      opts.signal.removeEventListener("abort", onAbort);
      await browser.close().catch(() => {});
    }
  },
};
