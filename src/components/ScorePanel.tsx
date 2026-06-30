import type { Grade, ScoreResult } from "../../shared/types";
import type { Phase } from "../state/useScan";

const GRADE_COLOR: Record<Grade, string> = {
  A: "#00e0a4",
  B: "#7ed957",
  C: "#ffd24d",
  D: "#ff9f1c",
  F: "#ff4d4d",
};

const GRADE_VERDICT: Record<Grade, string> = {
  A: "Excellent privacy",
  B: "Good, minor leaks",
  C: "Mediocre — watch out",
  D: "Poor — lots of tracking",
  F: "Critical — heavily tracked",
};

export function ScorePanel({
  score,
  phase,
  siteHost,
}: {
  score: ScoreResult;
  phase: Phase;
  siteHost?: string;
}) {
  if (phase === "idle") return null;
  const col = GRADE_COLOR[score.grade];
  const pct = Math.max(0, Math.min(100, score.value));
  const cleanHost = siteHost?.replace(/^www\./, "");

  return (
    <section className="panel score-panel">
      {cleanHost && (
        <div className="score-site">
          <span className="score-site-dot" style={{ background: col }} />
          <h2 className="score-site-name">{cleanHost}</h2>
        </div>
      )}
      <div className="score-hero">
        <div
          className="grade"
          style={{ color: col, borderColor: col, boxShadow: `0 0 32px ${col}38` }}
        >
          {score.grade}
        </div>
        <div className="score-num">
          <div className="score-val">
            <span style={{ color: col }}>{score.value}</span>
            <small>/ 100</small>
          </div>
          <div className="score-label">Privacy score</div>
          <div className="score-verdict" style={{ color: col }}>
            {GRADE_VERDICT[score.grade]}
          </div>
        </div>
      </div>

      <div className="score-meter">
        <div
          className="score-meter-fill"
          style={{ width: `${pct}%`, background: col, boxShadow: `0 0 14px ${col}66` }}
        />
      </div>

      {score.breakdown.length === 0 ? (
        <p className="breakdown-ok">No third-party trackers detected 🎉</p>
      ) : (
        <ul className="breakdown">
          {score.breakdown.map((b, i) => (
            <li key={i}>
              <span className="bk-label">{b.label}</span>
              <b className="bk-delta">{b.delta}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
