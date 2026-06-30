import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { RequestEventData, TrackerCategory } from "../../shared/types";
import { CATEGORY_META, FIRST_PARTY_COLOR } from "../../shared/categories";
import { useSize } from "../hooks/useSize";

export interface GraphNode {
  id: string;
  label: string;
  entity: string;
  category: TrackerCategory;
  isCenter?: boolean;
  count: number;
  known: boolean;
  fingerprinting: boolean;
  /** Target angle (radians) for category clustering. */
  angle?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  count: number;
}
export interface GraphHandle {
  setCenter(host: string): void;
  addRequest(req: RequestEventData): void;
  reset(): void;
}

interface Props {
  onSelect: (n: GraphNode | null) => void;
  /** Results mode: graph is confined to its left panel and should re-fit all nodes. */
  split?: boolean;
}

function colorFor(n: GraphNode): string {
  return n.isCenter ? FIRST_PARTY_COLOR : CATEGORY_META[n.category].color;
}

/** Normalize an entity/domain into a stable merge key so "Comscore" and "comScore" collapse. */
function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Stable base angle per category so each category occupies its own sector of the ring.
const CATEGORY_ORDER = Object.keys(CATEGORY_META) as TrackerCategory[];
const CATEGORY_BASE_ANGLE: Record<string, number> = {};
CATEGORY_ORDER.forEach((cat, i) => {
  CATEGORY_BASE_ANGLE[cat] = (i / CATEGORY_ORDER.length) * Math.PI * 2 - Math.PI / 2;
});

export const Graph = forwardRef<GraphHandle, Props>(function Graph({ onSelect, split }, ref) {
  const fgRef = useRef<any>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const nodeMap = useRef<Map<string, GraphNode>>(new Map());
  const linkMap = useRef<Map<string, GraphLink>>(new Map());
  const centerKey = useRef<string>("");
  const catCounts = useRef<Map<string, number>>(new Map());
  const hovered = useRef<GraphNode | null>(null);
  const [data, setData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [legend, setLegend] = useState<TrackerCategory[]>([]);
  const [containerRef, size] = useSize();

  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshLegend = () => {
    const present = new Set<TrackerCategory>();
    for (const n of nodesRef.current) if (!n.isCenter) present.add(n.category);
    const ordered = CATEGORY_ORDER.filter((c) => present.has(c));
    setLegend(ordered);
  };

  const commit = () => {
    setData({ nodes: [...nodesRef.current], links: [...linksRef.current] });
    refreshLegend();
  };
  const emitParticle = (link: GraphLink) => {
    try {
      fgRef.current?.emitParticle(link);
    } catch {
      /* link not yet in sim */
    }
  };
  const scheduleFit = () => {
    if (fitTimer.current) clearTimeout(fitTimer.current);
    fitTimer.current = setTimeout(() => {
      try {
        fgRef.current?.zoomToFit(600, 60);
      } catch {
        /* ignore */
      }
    }, 450);
  };

  // Assign a target angle that fans nodes out within their category's sector.
  const angleFor = (cat: TrackerCategory): number => {
    const base = CATEGORY_BASE_ANGLE[cat] ?? 0;
    const i = catCounts.current.get(cat) ?? 0;
    catCounts.current.set(cat, i + 1);
    // symmetric fan: 0, +s, -s, +2s, -2s ...
    const step = 0.16;
    const offset = Math.ceil(i / 2) * step * (i % 2 === 0 ? 1 : -1);
    return base + offset;
  };

  // Spread out + cluster by category: stronger repulsion, longer links, and a
  // custom force that pulls each node toward its category's angular sector.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    try {
      fg.d3Force("charge")?.strength(-260);
      fg.d3Force("link")?.distance(80);

      let _nodes: GraphNode[] = [];
      const cluster = (alpha: number) => {
        const c = nodeMap.current.get(centerKey.current);
        const cx = c?.x ?? 0;
        const cy = c?.y ?? 0;
        const k = alpha * 0.5;
        for (const n of _nodes) {
          if (n.isCenter || n.angle == null) continue;
          const dx = (n.x ?? 0) - cx;
          const dy = (n.y ?? 0) - cy;
          const dist = Math.hypot(dx, dy) || 1;
          // target point: same distance from center, but along the category ray
          const tx = cx + Math.cos(n.angle) * dist;
          const ty = cy + Math.sin(n.angle) * dist;
          n.vx = (n.vx ?? 0) + (tx - (n.x ?? 0)) * k;
          n.vy = (n.vy ?? 0) + (ty - (n.y ?? 0)) * k;
        }
      };
      (cluster as any).initialize = (nodes: GraphNode[]) => {
        _nodes = nodes;
      };
      fg.d3Force("cluster", cluster);
    } catch {
      /* ignore */
    }
  }, []);

  // Re-fit all nodes whenever we enter results mode or the panel resizes.
  useEffect(() => {
    if (!nodesRef.current.length) return;
    const t = setTimeout(() => {
      try {
        fgRef.current?.zoomToFit(700, 70);
      } catch {
        /* ignore */
      }
    }, 80);
    return () => clearTimeout(t);
  }, [split, size.w, size.h]);

  useImperativeHandle(ref, () => ({
    reset() {
      nodesRef.current = [];
      linksRef.current = [];
      nodeMap.current.clear();
      linkMap.current.clear();
      catCounts.current.clear();
      hovered.current = null;
      centerKey.current = "";
      setData({ nodes: [], links: [] });
      setLegend([]);
    },
    setCenter(host) {
      const key = normKey(host);
      centerKey.current = key;
      if (!nodeMap.current.has(key)) {
        const n: GraphNode = {
          id: key,
          label: host,
          entity: host,
          category: "essential",
          isCenter: true,
          count: 0,
          known: true,
          fingerprinting: false,
        };
        nodeMap.current.set(key, n);
        nodesRef.current.push(n);
        commit();
      }
    },
    addRequest(req) {
      if (!req.isThirdParty || !centerKey.current) return;
      const rawId = req.entity || req.domain;
      const key = normKey(rawId);
      if (!key || key === centerKey.current) return;
      let changed = false;
      let node = nodeMap.current.get(key);
      if (!node) {
        node = {
          id: key,
          label: req.domain,
          entity: req.entity,
          category: req.category,
          count: 0,
          known: req.known,
          fingerprinting: req.fingerprinting,
          angle: angleFor(req.category),
        };
        nodeMap.current.set(key, node);
        nodesRef.current.push(node);
        const link: GraphLink = { source: centerKey.current, target: key, count: 0 };
        linkMap.current.set(key, link);
        linksRef.current.push(link);
        changed = true;
      } else if (req.known && !node.known) {
        // Upgrade a placeholder/unknown node to its richer known classification.
        node.known = true;
        node.entity = req.entity;
        node.category = req.category;
        node.angle = angleFor(req.category);
        changed = true;
      }
      node.count++;
      if (req.fingerprinting) node.fingerprinting = true;
      const link = linkMap.current.get(key)!;
      link.count++;
      if (changed) {
        commit();
        scheduleFit();
        requestAnimationFrame(() => emitParticle(link));
      } else {
        emitParticle(link);
      }
    },
  }));

  // Which node ids are emphasized given the current hover (star topology:
  // hovering a leaf highlights it + the center; hovering the center lights all).
  const highlightSet = (): Set<string> | null => {
    const h = hovered.current;
    if (!h) return null;
    if (h.isCenter) return null; // center hover = everything stays lit
    return new Set([h.id, centerKey.current]);
  };

  const linkColor = useCallback((l: any): string => {
    const tid = typeof l.target === "object" ? l.target.id : l.target;
    const t: GraphNode | undefined =
      typeof l.target === "object" ? l.target : nodeMap.current.get(l.target);
    const hl = highlightSet();
    const base = t ? colorFor(t) : "#334155";
    const alpha = hl ? (hl.has(tid) ? "ee" : "1f") : "99";
    return base + alpha;
  }, []);

  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, scale: number) => {
    const n = node as GraphNode;
    const hl = highlightSet();
    const dim = hl ? !hl.has(n.id) : false;
    const r = n.isCenter ? 10 : 4 + Math.min(9, Math.sqrt(n.count));
    const col = colorFor(n);

    ctx.globalAlpha = dim ? 0.18 : 1;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = (n.isCenter ? 22 : 10) * (dim ? 0 : 1);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Fingerprinting nodes get a pulsing white ring — a "danger" cue.
    if (n.fingerprinting && !n.isCenter) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 320 + (n.x ?? 0));
      ctx.globalAlpha = dim ? 0.18 : pulse;
      ctx.lineWidth = 2 / scale;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 2 / scale, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.globalAlpha = dim ? 0.18 : 1;
    }

    // Labels: always for center; for leaves only when zoomed in, hovered, or heavy.
    const showLabel =
      n.isCenter || !dim && (scale > 1.15 || n.count >= 8 || (hl && hl.has(n.id)));
    if (showLabel) {
      const label = n.isCenter ? n.label : n.entity;
      const fs = (n.isCenter ? 13 : 10.5) / scale;
      ctx.font = `${n.isCenter ? 700 : 500} ${fs}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = n.isCenter ? "#eafff8" : "rgba(214,226,240,0.88)";
      ctx.fillText(label, node.x, node.y + r + 3 / scale);
    }
    ctx.globalAlpha = 1;
  }, []);

  const pointerPaint = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color;
    const r = (node as GraphNode).isCenter ? 12 : 10;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  const onHover = useCallback((n: any) => {
    hovered.current = (n as GraphNode) ?? null;
    if (containerRef.current) containerRef.current.style.cursor = n ? "pointer" : "default";
  }, [containerRef]);

  const legendItems = useMemo(
    () => legend.map((c) => ({ key: c, ...CATEGORY_META[c] })),
    [legend],
  );

  return (
    <div ref={containerRef} className="graph-wrap">
      {legendItems.length > 0 && (
        <ul className="graph-legend">
          <li className="graph-legend__head">
            <span className="graph-legend__dot" style={{ background: FIRST_PARTY_COLOR }} />
            This site
          </li>
          {legendItems.map((it) => (
            <li key={it.key}>
              <span className="graph-legend__dot" style={{ background: it.color }} />
              {it.label}
            </li>
          ))}
        </ul>
      )}
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        nodeRelSize={5}
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={pointerPaint}
        linkColor={linkColor}
        linkCurvature={0.12}
        linkWidth={(l: any) => Math.min(3, 0.6 + Math.log10((l.count || 1) + 1))}
        linkDirectionalParticleColor={linkColor}
        linkDirectionalParticleWidth={3}
        linkDirectionalParticleSpeed={0.012}
        onNodeClick={(n: any) => onSelect(n as GraphNode)}
        onNodeHover={onHover}
        onBackgroundClick={() => onSelect(null)}
        d3VelocityDecay={0.28}
        cooldownTime={15000}
      />
    </div>
  );
});
