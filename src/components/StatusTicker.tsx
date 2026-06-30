import type { Phase, StatusLine } from "../state/useScan";

export function StatusTicker({ lines, phase }: { lines: StatusLine[]; phase: Phase }) {
  if (phase === "idle") return null;
  const last = lines.slice(-3);
  return (
    <div className="status-ticker">
      {phase === "scanning" && <span className="pulse-dot" />}
      <div className="status-lines">
        {last.length === 0 && phase === "scanning" ? (
          <div className="status-line">starting…</div>
        ) : (
          last.map((l, i) => (
            <div key={i} className={"status-line lvl-" + l.level}>
              {l.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
