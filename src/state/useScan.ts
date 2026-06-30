import { useCallback, useReducer, useRef } from "react";
import type { ScanEvent, ScanSummary, ScoreResult } from "../../shared/types";
import { CATEGORY_META } from "../../shared/categories";
import { score } from "../../shared/score";
import { startScan } from "../api/scanStream";

export type Phase = "idle" | "scanning" | "done" | "error";

export interface CookieRow {
  name: string;
  domain: string;
  entity: string;
}
export interface StatusLine {
  level: "info" | "warn" | "error";
  message: string;
}

export interface ScanState {
  phase: Phase;
  url: string;
  siteHost: string;
  provider: string;
  totalRequests: number;
  thirdPartyRequests: number;
  tpEntities: string[];
  tpDomains: string[];
  adtech: string[];
  fpEntities: string[];
  fpApis: string[];
  strongFp: boolean;
  cookies: CookieRow[];
  status: StatusLine[];
  liveScore: ScoreResult;
  summary: ScanSummary | null;
  error: string | null;
}

const emptyScore = score({
  thirdPartyEntities: 0,
  thirdPartyDomains: 0,
  adtechEntities: 0,
  fingerprintingDetected: false,
  fingerprintingEntities: 0,
  thirdPartyCookies: 0,
});

const initial: ScanState = {
  phase: "idle",
  url: "",
  siteHost: "",
  provider: "",
  totalRequests: 0,
  thirdPartyRequests: 0,
  tpEntities: [],
  tpDomains: [],
  adtech: [],
  fpEntities: [],
  fpApis: [],
  strongFp: false,
  cookies: [],
  status: [],
  liveScore: emptyScore,
  summary: null,
  error: null,
};

function add(arr: string[], x: string): string[] {
  return arr.includes(x) ? arr : [...arr, x];
}

function recompute(s: ScanState): ScoreResult {
  return score({
    thirdPartyEntities: s.tpEntities.length,
    thirdPartyDomains: s.tpDomains.length,
    adtechEntities: s.adtech.length,
    fingerprintingDetected: s.strongFp,
    fingerprintingEntities: s.fpEntities.length,
    thirdPartyCookies: s.cookies.length,
  });
}

type Action =
  | { type: "reset" }
  | { type: "begin"; url: string }
  | { type: "event"; e: ScanEvent };

function reducer(state: ScanState, action: Action): ScanState {
  switch (action.type) {
    case "reset":
      return initial;
    case "begin":
      return { ...initial, phase: "scanning", url: action.url };
    case "event": {
      const e = action.e;
      switch (e.type) {
        case "meta":
          return { ...state, siteHost: e.siteHost, provider: e.provider, phase: "scanning" };
        case "status":
          return { ...state, status: [...state.status, { level: e.level, message: e.message }] };
        case "request": {
          const r = e.req;
          let s: ScanState = { ...state, totalRequests: state.totalRequests + 1 };
          if (r.isThirdParty) {
            s.thirdPartyRequests = state.thirdPartyRequests + 1;
            s.tpEntities = add(state.tpEntities, r.entity);
            s.tpDomains = add(state.tpDomains, r.domain);
            if (CATEGORY_META[r.category].adtech) s.adtech = add(state.adtech, r.entity);
            if (r.fingerprinting) s.fpEntities = add(state.fpEntities, r.entity);
          }
          s.liveScore = recompute(s);
          return s;
        }
        case "fingerprint": {
          if (state.fpApis.includes(e.api)) return state;
          const strong = state.strongFp || /^(canvas|webgl|audio)/.test(e.api);
          const s: ScanState = { ...state, fpApis: [...state.fpApis, e.api], strongFp: strong };
          s.liveScore = recompute(s);
          return s;
        }
        case "cookie": {
          const key = `${e.name}@${e.domain}`;
          if (state.cookies.some((c) => `${c.name}@${c.domain}` === key)) return state;
          const s: ScanState = {
            ...state,
            cookies: [...state.cookies, { name: e.name, domain: e.domain, entity: e.entity }],
          };
          s.liveScore = recompute(s);
          return s;
        }
        case "done":
          return {
            ...state,
            phase: "done",
            summary: e.summary,
            liveScore: e.summary.score,
            status: [
              ...state.status,
              { level: "info", message: `✓ scan complete — ${e.summary.elapsedMs} ms` },
            ],
          };
        case "error":
          return { ...state, phase: "error", error: e.message };
        default:
          return state;
      }
    }
    default:
      return state;
  }
}

export function useScan() {
  const [state, dispatch] = useReducer(reducer, initial);
  const closeRef = useRef<null | (() => void)>(null);

  const start = useCallback(
    (url: string, provider: string | undefined, onGraphEvent: (e: ScanEvent) => void) => {
      closeRef.current?.();
      dispatch({ type: "begin", url });
      closeRef.current = startScan(url, provider, (e) => {
        dispatch({ type: "event", e });
        onGraphEvent(e);
      });
    },
    [],
  );

  const reset = useCallback(() => {
    closeRef.current?.();
    dispatch({ type: "reset" });
  }, []);

  return { state, start, reset };
}
