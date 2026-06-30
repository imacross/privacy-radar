import type { Phase } from "../state/useScan";
import { ScanInput } from "./ScanInput";

const EXAMPLES = ["cnn.com", "nytimes.com", "weather.com", "forbes.com"];

const CARDS = [
  {
    icon: "🌐",
    title: "A real browser, not a guess",
    body: "We open the site in an actual browser and capture every network request it fires — live.",
  },
  {
    icon: "🏢",
    title: "Who really gets your data",
    body: "Each request is traced back to the company behind it: ad networks, analytics, data brokers.",
  },
  {
    icon: "🛡️",
    title: "Fingerprinting & a privacy score",
    body: "We flag canvas, WebGL and audio fingerprinting, then grade the site from A to F.",
  },
];

interface Props {
  phase: Phase;
  onScan: (url: string) => void;
}

export function Landing({ phase, onScan }: Props) {
  return (
    <div className="landing">
      <section className="landing-hero">
        <h1 className="wordmark">
          <img src="/radar.svg" alt="" />
          Privacy<span>Radar</span>
        </h1>

        <ScanInput phase={phase} variant="hero" onScan={onScan} />

        <div className="landing-examples">
          <span>Try</span>
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => onScan(e)}>
              {e}
            </button>
          ))}
        </div>
      </section>

      <section className="landing-info">
        <h2 className="landing-question">
          When you open a website, <span>who's watching you</span> behind the scenes?
        </h2>

        <div className="info-cards">
          {CARDS.map((c) => (
            <article key={c.title} className="info-card">
              <span className="info-icon">{c.icon}</span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
