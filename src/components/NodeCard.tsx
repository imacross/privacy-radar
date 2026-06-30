import type { GraphNode } from "./Graph";
import { CATEGORY_META } from "../../shared/categories";

export function NodeCard({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  if (node.isCenter) {
    return (
      <div className="node-card">
        <button className="close" onClick={onClose} aria-label="close">
          ×
        </button>
        <div className="nc-entity">{node.label}</div>
        <div className="nc-cat">The site you scanned (first party)</div>
      </div>
    );
  }

  const meta = CATEGORY_META[node.category];
  return (
    <div className="node-card">
      <button className="close" onClick={onClose} aria-label="kapat">
        ×
      </button>
      <div className="nc-head">
        <span className="nc-dot" style={{ background: meta.color }} />
        <div>
          <div className="nc-entity">{node.entity}</div>
          <div className="nc-cat" style={{ color: meta.color }}>
            {meta.label}
          </div>
        </div>
      </div>
      <div className="nc-domain">{node.label}</div>
      <div className="nc-meta">
        <span>{node.count} requests</span>
        {node.fingerprinting && <span className="fp-tag">fingerprinting</span>}
        {!node.known && <span className="muted">not in catalog</span>}
      </div>
    </div>
  );
}
