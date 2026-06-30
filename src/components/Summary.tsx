import type { ScanState } from "../state/useScan";

type Metric = {
  n: number;
  label: string;
  sub: string;
  icon: string;
  color: string;
};

function MetricRow({ m }: { m: Metric }) {
  return (
    <div className="metric" style={{ ["--mc" as string]: m.color }}>
      <div className="metric-icon" aria-hidden>
        {m.icon}
      </div>
      <div className="metric-text">
        <span className="metric-label">{m.label}</span>
        <span className="metric-sub">{m.sub}</span>
      </div>
      <b className="metric-n">{m.n}</b>
    </div>
  );
}

export function Summary({ state }: { state: ScanState }) {
  if (state.phase === "idle") return null;
  const s = state.summary;
  const companies = s ? s.entities.length : state.tpEntities.length;
  const requests = s ? s.totalRequests : state.totalRequests;
  const domains = s ? s.thirdPartyDomains : state.tpDomains.length;
  const cookies = s ? s.thirdPartyCookies : state.cookies.length;

  const metrics: Metric[] = [
    { n: requests, label: "Network requests", sub: "total calls made", icon: "↯", color: "#7aa2ff" },
    { n: companies, label: "Companies reached", sub: "distinct organisations", icon: "🏢", color: "#00e0a4" },
    { n: domains, label: "Third-party domains", sub: "external endpoints", icon: "🌐", color: "#ffd24d" },
    { n: cookies, label: "Third-party cookies", sub: "stored on your device", icon: "🍪", color: "#ff9f1c" },
  ];

  return (
    <section className="panel summary-panel">
      <h3 className="panel-title">Where your data went</h3>
      <div className="metric-list">
        {metrics.map((m) => (
          <MetricRow key={m.label} m={m} />
        ))}
      </div>
      {s && companies > 0 && (
        <p className="shock">
          Your data goes to <b>{companies}</b> companies — <b>{s.unfamiliarCount}</b> of which
          you've probably never heard of.
        </p>
      )}
    </section>
  );
}
