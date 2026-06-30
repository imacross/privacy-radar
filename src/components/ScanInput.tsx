import { useState, type FormEvent } from "react";
import type { Phase } from "../state/useScan";

interface Props {
  phase: Phase;
  variant?: "hero" | "bar";
  onScan: (url: string) => void;
}

export function ScanInput({ phase, variant = "bar", onScan }: Props) {
  const [url, setUrl] = useState("");
  const scanning = phase === "scanning";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = url.trim();
    if (v) onScan(v);
  };

  return (
    <form className={"scan-input si-" + variant} onSubmit={submit}>
      <span className="si-icon">🔎</span>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={
          variant === "hero" ? "Enter a website — e.g. cnn.com" : "scan another site…"
        }
        spellCheck={false}
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
      />
      <button type="submit" disabled={scanning}>
        {scanning ? "Scanning…" : "Scan"}
      </button>
    </form>
  );
}
