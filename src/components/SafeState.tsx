import type { ScanState } from "../state/useScan";

/**
 * Shown over the graph area when a scan finds no third-party trackers —
 * the graph would otherwise be empty (just the first-party node).
 */
export function SafeState({ state }: { state: ScanState }) {
  const host = state.siteHost || "this site";
  const requests = state.summary?.totalRequests ?? state.totalRequests;
  return (
    <div className="safe-state">
      <div className="safe-badge">
        <svg viewBox="0 0 24 24" width="46" height="46" fill="none" aria-hidden>
          <path
            d="M12 2.5 4.5 5.5v5.2c0 4.6 3.1 8.4 7.5 9.8 4.4-1.4 7.5-5.2 7.5-9.8V5.5L12 2.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="m8.6 12 2.3 2.3 4.5-4.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="safe-title">No trackers found</h2>
      <p className="safe-text">
        <b>{host}</b> didn’t hand your visit to a single third-party company across{" "}
        <b>{requests}</b> network requests. Nothing followed you here.
      </p>
      <div className="safe-pills">
        <span>0 companies</span>
        <span>0 third-party domains</span>
        <span>0 tracking cookies</span>
      </div>
    </div>
  );
}
