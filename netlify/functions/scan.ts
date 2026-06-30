import type { Context } from "@netlify/functions";
import { classify, isHouseholdName } from "../../shared/classify";
import { hostOf, registrableDomain } from "../../shared/psl";
import { CATEGORY_META } from "../../shared/categories";
import { score } from "../../shared/score";
import type { ScanEvent, ScanSummary } from "../../shared/types";
import type { CaptureProvider, RawHooks } from "./_providers/types";
import { localProvider } from "./_providers/local";
import { crawlsnapProvider } from "./_providers/crawlsnap";

const SSE_HEADERS: Record<string, string> = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

function normalizeUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const u = new URL(req.url);
  const target = normalizeUrl(u.searchParams.get("url") ?? "");
  const providerName = (u.searchParams.get("provider") || process.env.CAPTURE_PROVIDER || "local").toLowerCase();

  if (!target) {
    return new Response(`data: ${JSON.stringify({ type: "error", message: "Invalid URL" })}\n\n`, {
      status: 400,
      headers: SSE_HEADERS,
    });
  }

  const provider: CaptureProvider = providerName === "crawlsnap" ? crawlsnapProvider : localProvider;
  // Netlify free sync functions cap ~10s, so `local` defaults to a 9s budget.
  // `netlify dev` has no such cap — override with SCAN_DEADLINE_MS for richer demos.
  const envDeadline = Number(process.env.SCAN_DEADLINE_MS);
  const deadlineMs = Number.isFinite(envDeadline) && envDeadline > 0
    ? envDeadline
    : providerName === "crawlsnap"
      ? 45000
      : 9000;
  const siteDomain = registrableDomain(hostOf(target));
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const emit = (e: ScanEvent) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* stream already torn down */
        }
      };

      // ---- accumulators ----
      let totalRequests = 0;
      let thirdPartyRequests = 0;
      let knownTrackerRequests = 0;
      const tpDomains = new Set<string>();
      const tpEntities = new Set<string>();
      const adtechEntities = new Set<string>();
      const fpEntities = new Set<string>();
      const fpApis = new Set<string>();
      const tpCookies = new Set<string>();
      let strongFp = false;
      let finalUrl = target;
      let title: string | null = null;

      emit({ type: "meta", siteHost: hostOf(target), provider: provider.name, startedAt });

      const hooks: RawHooks = {
        onSiteResolved(fu, t) {
          finalUrl = fu || target;
          title = t;
        },
        onRequest(r) {
          const host = hostOf(r.url);
          if (!host) return;
          const c = classify(host, siteDomain);
          totalRequests++;
          if (c.isThirdParty) {
            thirdPartyRequests++;
            tpDomains.add(c.domain);
            tpEntities.add(c.entity);
            if (c.known) knownTrackerRequests++;
            if (CATEGORY_META[c.category].adtech) adtechEntities.add(c.entity);
            if (c.fingerprinting) fpEntities.add(c.entity);
          }
          emit({ type: "request", req: { ...c, url: r.url, resourceType: r.resourceType } });
        },
        onFingerprint(api) {
          if (fpApis.has(api)) return;
          fpApis.add(api);
          if (/^(canvas|webgl|audio)/.test(api)) strongFp = true;
          emit({ type: "fingerprint", api });
        },
        onCookie(c) {
          const bare = c.domain.replace(/^\./, "");
          const dom = registrableDomain(bare);
          if (dom === siteDomain) return; // only surface third-party cookies
          const key = `${c.name}@${dom}`;
          if (tpCookies.has(key)) return;
          tpCookies.add(key);
          emit({
            type: "cookie",
            name: c.name,
            domain: dom,
            entity: classify(bare, siteDomain).entity,
            isThirdParty: true,
          });
        },
        onStatus(level, message) {
          emit({ type: "status", level, message });
        },
      };

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), deadlineMs);
      try {
        await provider.capture(target, hooks, { deadlineMs, signal: ac.signal });
      } catch (err: any) {
        emit({ type: "status", level: "warn", message: `Capture partially completed: ${err?.message ?? err}` });
      } finally {
        clearTimeout(timer);
      }

      const entities = [...tpEntities];
      const summary: ScanSummary = {
        siteHost: hostOf(target),
        finalUrl,
        title,
        totalRequests,
        thirdPartyRequests,
        thirdPartyDomains: tpDomains.size,
        entities,
        unfamiliarCount: entities.filter((e) => !isHouseholdName(e)).length,
        knownTrackerRequests,
        thirdPartyCookies: tpCookies.size,
        fingerprintingApis: [...fpApis],
        score: score({
          thirdPartyEntities: tpEntities.size,
          thirdPartyDomains: tpDomains.size,
          adtechEntities: adtechEntities.size,
          fingerprintingDetected: strongFp,
          fingerprintingEntities: fpEntities.size,
          thirdPartyCookies: tpCookies.size,
        }),
        provider: provider.name,
        elapsedMs: Date.now() - startedAt,
      };
      emit({ type: "done", summary });

      closed = true;
      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
};
