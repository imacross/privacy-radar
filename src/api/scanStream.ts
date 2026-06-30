import type { ScanEvent } from "../../shared/types";

/**
 * Opens the SSE scan stream and forwards each parsed event. Returns a closer.
 * The stream self-terminates on `done`/`error`; we close the EventSource then so
 * the browser does not auto-reconnect.
 */
export function startScan(
  url: string,
  provider: string | undefined,
  onEvent: (e: ScanEvent) => void,
): () => void {
  const params = new URLSearchParams({ url });
  if (provider) params.set("provider", provider);
  const es = new EventSource(`/api/scan?${params.toString()}`);

  let finished = false;
  const close = () => {
    finished = true;
    es.close();
  };

  es.onmessage = (ev) => {
    let parsed: ScanEvent;
    try {
      parsed = JSON.parse(ev.data) as ScanEvent;
    } catch {
      return;
    }
    onEvent(parsed);
    if (parsed.type === "done" || parsed.type === "error") close();
  };

  es.onerror = () => {
    if (finished) return;
    onEvent({ type: "error", message: "Stream connection lost." });
    close();
  };

  return close;
}
