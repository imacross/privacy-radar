import { useCallback, useRef, useState } from "react";
import { useScan } from "./state/useScan";
import { Graph, type GraphHandle, type GraphNode } from "./components/Graph";
import { Landing } from "./components/Landing";
import { LoadingScreen } from "./components/LoadingScreen";
import { ScanInput } from "./components/ScanInput";
import { ScorePanel } from "./components/ScorePanel";
import { Summary } from "./components/Summary";
import { FingerprintAlert } from "./components/FingerprintAlert";
import { NodeCard } from "./components/NodeCard";
import type { ScanEvent } from "../shared/types";

export default function App() {
  const graphRef = useRef<GraphHandle>(null);
  const { state, start, reset } = useScan();
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const onGraphEvent = useCallback((e: ScanEvent) => {
    if (e.type === "meta") graphRef.current?.setCenter(e.siteHost);
    else if (e.type === "request") graphRef.current?.addRequest(e.req);
  }, []);

  const handleScan = useCallback(
    (url: string) => {
      setSelected(null);
      graphRef.current?.reset();
      // Provider is configured server-side via CAPTURE_PROVIDER (default: local).
      start(url, undefined, onGraphEvent);
    },
    [start, onGraphEvent],
  );

  const handleHome = useCallback(() => {
    setSelected(null);
    graphRef.current?.reset();
    reset();
  }, [reset]);

  const showResults = state.phase === "done" || state.phase === "error";

  return (
    <div className={"app" + (showResults ? " results" : "")}>
      <Graph ref={graphRef} onSelect={setSelected} split={showResults} />

      {state.phase === "idle" && <Landing phase={state.phase} onScan={handleScan} />}

      {state.phase === "scanning" && <LoadingScreen state={state} />}

      {showResults && (
        <div className="overlay">
          <header className="topbar">
            <button type="button" className="brand" onClick={handleHome} title="Başa dön">
              <img src="/radar.svg" width={26} height={26} alt="" />
              <span className="brand-name">PrivacyRadar</span>
            </button>
            <ScanInput phase={state.phase} onScan={handleScan} />
          </header>

          <aside className="result-bar panel">
            <ScorePanel score={state.summary?.score ?? state.liveScore} phase={state.phase} />
            <Summary state={state} />
          </aside>

          <FingerprintAlert apis={state.fpApis} strong={state.strongFp} />
          {selected && <NodeCard node={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}
