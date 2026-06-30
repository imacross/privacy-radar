import { useEffect, useState } from "react";
import type { ScanState } from "../state/useScan";

/** Shown while no live status line has arrived yet, then as gentle filler. */
const PHRASES = [
  "Opening the site in a real browser…",
  "Letting its scripts load and cookies drop…",
  "Watching every network request leave your machine…",
  "Tracing each request back to the company behind it…",
  "Looking for fingerprinting attempts…",
  "Scoring how much of you this page gives away…",
];

export function LoadingScreen({ state }: { state: ScanState }) {
  const last = state.status[state.status.length - 1];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => i + 1), 2400);
    return () => clearInterval(t);
  }, []);

  const headline = last ? last.message : PHRASES[idx % PHRASES.length];
  const host = state.siteHost || state.url;

  return (
    <div className="loading">
      <div className="radar">
        <div className="radar-ring" />
        <div className="radar-ring r2" />
        <div className="radar-ring r3" />
        <div className="radar-sweep" />
        <div className="radar-core" />
      </div>

      <div className="loading-host">scanning {host}</div>

      <div className="loading-headline" key={headline}>
        {headline}
      </div>

      <div className="loading-stats">
        <div className="ls">
          <b>{state.totalRequests}</b>
          <span>requests seen</span>
        </div>
        <div className="ls">
          <b>{state.tpEntities.length}</b>
          <span>companies found</span>
        </div>
        <div className="ls">
          <b>{state.fpApis.length}</b>
          <span>fingerprint signals</span>
        </div>
      </div>
    </div>
  );
}
