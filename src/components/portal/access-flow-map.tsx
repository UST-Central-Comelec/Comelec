"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRightLeft, LocateFixed, Pause, Play } from "lucide-react";
import { AddIcon as Plus, CloseIcon as X } from "@/components/action-icons";
import { ShieldCheck } from "./portal-nav-icons";
import { groupIcons, tabIcons } from "./portal-tab-icons";
import type { TabKey } from "@/lib/portal/access";
import { createFlowLayout, flowCoordinate, type FlowEdge, type FlowNode } from "./access-flow-layout";
import { useCanvasZoom } from "./use-canvas-zoom";
import { useCanvasPan } from "./use-canvas-pan";
import type { AccessGroup } from "./access-control-form";

const branchColors: Record<string, string> = {
  Dashboard: "254,195,12",
  Services: "76,201,218",
  Documents: "129,184,210",
  Charters: "189,165,234",
  Secretariat: "167,139,250",
  Legals: "189,165,234",
  "Petitions and Cases": "251,137,115",
  Recruitment: "92,211,161",
  "Political Party": "235,130,183",
  "Filing of Candidacy": "111,166,255",
  Administrative: "224,174,104",
};
const branchStyle = (name: string): CSSProperties => ({ "--flow-rgb": branchColors[name] ?? "254,195,12", "--flow-color": `rgb(${branchColors[name] ?? "254,195,12"})` } as CSSProperties);

const beamLayers = [
  { length: 34, width: 1.4, opacity: .12 },
  { length: 18, width: 2.2, opacity: .4 },
  { length: 3, width: 3.4, opacity: 1 },
];

function pulseNode(element: HTMLButtonElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.getAnimations().filter(animation => animation.id === "node-click-pulse").forEach(animation => animation.cancel());
  const shadow = getComputedStyle(element).boxShadow;
  const pulse = element.animate([
    { boxShadow: `${shadow}, 0 0 0 0 rgba(255,255,255,.28)` },
    { boxShadow: `${shadow}, 0 0 12px 14px rgba(255,255,255,.14)`, offset: .4 },
    { boxShadow: `${shadow}, 0 0 20px 28px rgba(255,255,255,0)` },
  ], { duration: 600, easing: "ease-out" });
  pulse.id = "node-click-pulse";
}

/** One canvas-wide clock launches up to five beams per five-second slot. */
function FlowBeams({ batches, groups, paused }: { batches: FlowEdge[][]; groups: AccessGroup[]; paused: boolean }) {
  const [release, setRelease] = useState(0);
  useEffect(() => {
    if (paused || !batches.length) return;
    const timer = window.setInterval(() => setRelease(value => value + 1), 5000);
    return () => window.clearInterval(timer);
  }, [paused, batches.length]);
  return (batches[release % batches.length] ?? []).map(edge => {
    const group = groups[edge.to.groupIndex];
    return <g key={`${release}:${edge.to.id}`} className="portal-flow-pulse" style={branchStyle(group.label ?? group.tabs[0].label)}>
      {beamLayers.map((layer, index) => <path key={layer.length} d={edge.path} pathLength="100" className={`portal-flow-beam${index === beamLayers.length - 1 ? " is-head" : ""}`} style={{
        "--beam-length": layer.length,
        "--beam-gap": 200 - layer.length,
        "--beam-end": layer.length - 134,
        strokeWidth: layer.width,
        opacity: layer.opacity,
      } as CSSProperties} />)}
    </g>;
  });
}

export function AccessFlowMap({ groups, open, levelName, disabled, onChange, immersive = false, renderCenterPanel, overlay, saveControl, resetControl, onReady }: { onReady?: () => void; resetControl?: ReactNode; saveControl?: ReactNode; overlay?: ReactNode; renderCenterPanel?: (tools: ReactNode) => ReactNode; immersive?: boolean; groups: AccessGroup[]; open: ReadonlySet<TabKey>; levelName: string; disabled: boolean; onChange: (keys: TabKey[], on: boolean) => void }) {
  const centerPanelId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const baseLayout = useMemo(() => createFlowLayout(groups), [groups]);
  const [available, setAvailable] = useState({ width: baseLayout.width, height: 660, left: 0, top: 0 });
  const [manualZoom, setManualZoom] = useState<number | null>(.5);
  const [minZoom, setMinZoom] = useState(.3);
  useEffect(() => {
    // Physical display inches are unavailable; use the display's logical width as a proxy.
    const updateZoomLimit = () => setMinZoom(window.screen.width < 1600 ? .45 : .3);
    updateZoomLimit();
    window.addEventListener("resize", updateZoomLimit);
    return () => window.removeEventListener("resize", updateZoomLimit);
  }, []);
  const [paused, setPaused] = useState(false);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [pathNode, setPathNode] = useState<FlowNode | null>(null);
  const [nodeDisplay, setNodeDisplay] = useState(0);
  const nodeDisplayModes = ["Icon + label", "Icon only", "Label only"];
  const [hoveredNode, setInfoNode] = useState<FlowNode | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoPinned, setInfoPinned] = useState(false);
  const setHoveredNode = (node: FlowNode | null) => {
    setPathNode(node);
    if (infoPinned) return;
    if (node) setInfoNode(node);
    setInfoVisible(node !== null);
  };
  const fitZoom = Math.min(1, Math.max(160, available.width - (immersive ? 64 : 0)) / baseLayout.width, Math.max(160, available.height - (immersive ? 32 : 0)) / baseLayout.height);
  const zoom = Math.max(minZoom, manualZoom ?? fitZoom);
  const layout = baseLayout;
  const { panning, getOffset, movePan, handlers } = useCanvasPan(viewport, stage, { width: layout.width, height: layout.height, zoom, centerVertically: immersive });
  const initialView = useRef({ width: baseLayout.width, height: baseLayout.height, immersive, movePan, onReady, centered: false });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let readyFrame: number | null = null;
    const observer = new ResizeObserver(([entry]) => {
      const initial = initialView.current;
      if (!initial.centered) {
        initial.centered = true;
        readyFrame = requestAnimationFrame(() => initial.onReady?.());
        initial.movePan({ x: Math.min(0, (entry.contentRect.width - initial.width * .5) / 2), y: initial.immersive ? Math.min(0, (entry.contentRect.height - initial.height * .5) / 2) : 0 });
      }
      const style = getComputedStyle(element);
      const next = { width: entry.contentRect.width, height: entry.contentRect.height, left: parseFloat(style.paddingLeft) || 0, top: parseFloat(style.paddingTop) || 0 };
      setAvailable(current => current.width === next.width && current.height === next.height && current.left === next.left && current.top === next.top ? current : next);
    });
    observer.observe(element);
    return () => { observer.disconnect(); if (readyFrame !== null) cancelAnimationFrame(readyFrame); };
  }, []);
  const highlightedConnections = useMemo(() => {
    const highlighted = new Set<string>();
    const pendingNodes = hoveredConnection ? [hoveredConnection] : [];
    while (pendingNodes.length) {
      const id = pendingNodes.pop()!;
      if (highlighted.has(id)) continue;
      highlighted.add(id);
      for (const edge of layout.edges) {
        if (edge.from.id === id) pendingNodes.push(edge.to.id);
      }
    }
    if (pathNode && pathNode.groupIndex >= 0) {
      const group = groups[pathNode.groupIndex];
      const active = pathNode.tabIndex === undefined ? group.tabs.some(tab => open.has(tab.key)) : open.has(group.tabs[pathNode.tabIndex].key);
      if (!active) {
        let edge = layout.edges.find(edge => edge.to.id === pathNode.id);
        while (edge && !highlighted.has(edge.to.id)) {
          highlighted.add(edge.to.id);
          const parentId = edge.from.id;
          edge = layout.edges.find(candidate => candidate.to.id === parentId);
        }
      }
    }
    return highlighted;
  }, [hoveredConnection, layout, pathNode, groups, open]);
  const canvasZoom = useCanvasZoom(viewport, stage, { zoom, minZoom, width: layout.width, height: layout.height, offset: getOffset(), getOffset, onZoom: setManualZoom, onPan: movePan, centerVertically: immersive });
  const recenter = (scale = zoom) => {
    canvasZoom.cancel();
    const verticalOffset = (available.height - layout.height * scale) / 2;
    movePan({ x: Math.min(0, (available.width - layout.width * scale) / 2), y: immersive ? Math.min(0, verticalOffset) : verticalOffset });
  };
  const root = layout.nodes[0];
  const hoveredGroup = hoveredNode && hoveredNode.groupIndex >= 0 ? groups[hoveredNode.groupIndex] : undefined;
  const hoveredTab = hoveredNode?.tabIndex !== undefined ? hoveredGroup?.tabs[hoveredNode.tabIndex] : undefined;
  const hoveredName = hoveredTab?.label ?? hoveredGroup?.label ?? hoveredGroup?.tabs[0].label ?? levelName;
  const HoverIcon = hoveredTab ? tabIcons[hoveredTab.key] : hoveredGroup ? (hoveredGroup.label ? groupIcons[hoveredGroup.label] : tabIcons[hoveredGroup.tabs[0].key]) : ShieldCheck;
  const hoveredTabs = hoveredTab ? [hoveredTab] : hoveredGroup?.tabs ?? [];
  const hoveredEnabled = hoveredTabs.filter(tab => open.has(tab.key)).length;
  // A changed branch gets a fresh animation timeline, beginning at the hub.
  const flowRuns = groups.map(group => group.tabs.filter(tab => open.has(tab.key)).map(tab => tab.key).join("|"));
  const beamBatches = useMemo(() => {
    const active = layout.edges.filter(edge => {
      const group = groups[edge.to.groupIndex];
      return edge.to.tabIndex === undefined ? group.tabs.some(tab => open.has(tab.key)) : open.has(group.tabs[edge.to.tabIndex].key);
    });
    const batch = (edges: FlowEdge[]) => {
      const batches: FlowEdge[][] = [];
      let index = 0;
      for (let remaining = Math.ceil(edges.length / 5); remaining > 0; remaining--) {
        const size = Math.ceil((edges.length - index) / remaining);
        batches.push(edges.slice(index, index + size));
        index += size;
      }
      return batches;
    };
    // Start at the hub, then distribute balanced batches along the outer branches.
    return [...batch(active.filter(edge => edge.to.tabIndex === undefined)), ...batch(active.filter(edge => edge.to.tabIndex !== undefined))];
  }, [groups, layout, open]);

  const canvasTools = (
    <div className="portal-flow-tools" role="group" aria-label="Canvas controls">
        <button type="button" aria-label={paused ? "Play connection flow" : "Pause connection flow"} title={paused ? "Play flow" : "Pause flow"} onClick={() => setPaused(!paused)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
      </div>
  );

  return (
    <div className={`portal-flow-map${paused ? " is-paused" : ""}${panning ? " is-panning" : ""}`}>
      <div className="portal-flow-controls">
        {saveControl}
        {resetControl}
        <button type="button" className="portal-flow-display-toggle" title={`Node display: ${nodeDisplayModes[nodeDisplay]}`} aria-label={`Node display: ${nodeDisplayModes[nodeDisplay]}. Switch to ${nodeDisplayModes[(nodeDisplay + 1) % 3]}`} onClick={() => setNodeDisplay(mode => (mode + 1) % 3)}><ArrowRightLeft size={14} aria-hidden="true" /></button>
        <button type="button" className="portal-flow-display-toggle" title="Recenter diagram" aria-label="Recenter diagram" onClick={() => recenter()}><LocateFixed size={14} aria-hidden="true" /></button>
        <output className="portal-flow-zoom" aria-label="Canvas zoom">{Math.round(zoom * 100)}%</output>
      </div>
      {overlay}
      <div className="portal-flow-viewport" style={{
        "--canvas-grid-step": `${48 * zoom}px`,
        "--flow-tooltip-scale": 1 / zoom,
        "--flow-tooltip-gap": `${12 / zoom}px`,
        "--canvas-dot-size": `${Math.max(.5, .7 * zoom)}px`,
        "--canvas-origin-x": `${available.left + Math.max(0, (available.width - layout.width * zoom) / 2)}px`,
        "--canvas-origin-y": `${available.top + (immersive ? Math.max(0, (available.height - layout.height * zoom) / 2) : 0)}px`,
      } as CSSProperties} ref={viewport} {...handlers} onPointerDownCapture={(event) => { if ((event.target as HTMLElement).closest(".portal-flow-details")) return; canvasZoom.cancel(); handlers.onPointerDownCapture(event); }} tabIndex={0} role="region" aria-label="Tab access diagram. Drag or hold and drag the background to pan. Scroll or pinch to zoom. Arrow keys pan when the canvas is focused.">
        <div className="portal-flow-size" style={{ width: layout.width * zoom, height: layout.height * zoom }}>
          <div className="portal-flow-stage" ref={stage} style={{ width: layout.width, height: layout.height, transform: `translate3d(var(--canvas-pan-x, 0px), var(--canvas-pan-y, 0px), 0) scale(${zoom})` }}>
            <svg className="portal-flow-orbits" width={layout.width} height={layout.height} aria-hidden="true">
              <circle cx={layout.center} cy={layout.center} r={layout.radius * .65} strokeWidth={layout.radius * .13} className="portal-flow-annulus" />
              {[.585, .715].map(ratio => <circle key={ratio} cx={layout.center} cy={layout.center} r={layout.radius * ratio} className="portal-flow-band-edge" />)}
              {Array.from({ length: 96 }, (_, i) => {
                const angle = i / 96 * Math.PI * 2;
                const inner = layout.radius * .585, outer = layout.radius * .715;
                return <line key={`spoke-${i}`} x1={flowCoordinate(layout.center + Math.cos(angle) * inner)} y1={flowCoordinate(layout.center + Math.sin(angle) * inner)} x2={flowCoordinate(layout.center + Math.cos(angle) * outer)} y2={flowCoordinate(layout.center + Math.sin(angle) * outer)} className="portal-flow-spoke" />;
              })}
              {[[.25, 0], [.52, 1], [1.09, 3]].map(([ratio, orbit]) => <circle key={ratio} cx={layout.center} cy={layout.center} r={layout.radius * ratio} className={`portal-flow-orbit orbit-${orbit}`} />)}
              <g className="portal-flow-ticks">{Array.from({ length: 80 }, (_, i) => {
                const angle = i / 80 * Math.PI * 2;
                const start = layout.radius * 1.12, end = start + (i % 5 === 0 ? 14 : 6);
                return <line key={i} x1={flowCoordinate(layout.center + Math.cos(angle) * start)} y1={flowCoordinate(layout.center + Math.sin(angle) * start)} x2={flowCoordinate(layout.center + Math.cos(angle) * end)} y2={flowCoordinate(layout.center + Math.sin(angle) * end)} className="portal-flow-tick" />;
              })}</g>
              {layout.sectors.map(sector => {
                const r = layout.radius * 1.09;
                const group = groups[sector.groupIndex];
                return <path key={sector.groupIndex} style={branchStyle(group.label ?? group.tabs[0].label)} className="portal-flow-sector" d={`M${flowCoordinate(layout.center + Math.cos(sector.start) * r)} ${flowCoordinate(layout.center + Math.sin(sector.start) * r)} A${r} ${r} 0 0 1 ${flowCoordinate(layout.center + Math.cos(sector.end) * r)} ${flowCoordinate(layout.center + Math.sin(sector.end) * r)}`} />;
              })}
            </svg>
            <svg className="portal-flow-wires" width={layout.width} height={layout.height} aria-hidden="true">
              {layout.edges.map((edge) => {
                const group = groups[edge.to.groupIndex];
                const active = edge.to.tabIndex === undefined ? group.tabs.some((tab) => open.has(tab.key)) : open.has(group.tabs[edge.to.tabIndex].key);
                return <g key={edge.to.id} style={branchStyle(group.label ?? group.tabs[0].label)}>
                  <path d={edge.path} className={`portal-flow-wire${active ? " is-connected" : ""}${!panning && highlightedConnections.has(edge.to.id) ? " is-highlighted" : ""}`} />
                  {!active && <path d={edge.path} className="portal-flow-wire-hit" strokeWidth={12 / zoom} onPointerEnter={event => { if (event.pointerType !== "touch") setHoveredConnection(edge.to.id); }} onPointerLeave={() => setHoveredConnection(null)} />}
                </g>;
              })}
              <FlowBeams key={flowRuns.join(";")} batches={beamBatches} groups={groups} paused={paused} />
            </svg>
            <button type="button" aria-label="Change access role" aria-describedby={`${centerPanelId}-root-tooltip`} aria-expanded={infoPinned} aria-controls={centerPanelId} className="portal-card portal-flow-root" onPointerEnter={() => setHoveredNode(root)} onPointerLeave={() => setHoveredNode(null)} onClick={(event) => { pulseNode(event.currentTarget); setInfoNode(root); setInfoVisible(!infoPinned); setInfoPinned(!infoPinned); }} onKeyDown={(event) => { if (event.key === "Escape") { setInfoPinned(false); setInfoVisible(false); } }} style={{ left: root.x - root.width / 2, top: root.y - root.height / 2, width: root.width, height: root.height }}>{nodeDisplay !== 2 && <span className="portal-flow-icon"><Plus size={64} aria-hidden="true" /></span>}{nodeDisplay !== 1 && <span className="portal-flow-caption"><strong>{levelName}</strong></span>}<span id={`${centerPanelId}-root-tooltip`} role="tooltip" className="portal-flow-tooltip">Change access role: {levelName}</span></button>
            {layout.nodes.slice(1).map((node) => {
              const group = groups[node.groupIndex];
              const name = group.label ?? group.tabs[0].label;
              const isGroup = node.tabIndex === undefined;
              const tab = isGroup ? undefined : group.tabs[node.tabIndex!];
              const free = group.tabs;
              const count = group.tabs.filter((tab) => open.has(tab.key)).length;
              const all = free.length > 0 && free.every((tab) => open.has(tab.key));
              const connected = tab ? open.has(tab.key) : count > 0;
              const Icon = tab ? tabIcons[tab.key] : group.label ? groupIcons[group.label] : tabIcons[group.tabs[0].key];
              const label = tab ? `${name}: ${tab.label}` : name;
              const next = tab ? !connected : !all;
              return <button key={node.id} type="button" onPointerEnter={() => setHoveredNode(node)} onPointerLeave={() => setHoveredNode(null)} onFocus={() => setHoveredNode(node)} onBlur={() => setHoveredNode(null)} className={`portal-card portal-flow-node${isGroup ? " is-group" : ""}${connected ? " is-connected" : ""}`} style={{ ...branchStyle(name), left: node.x - node.width / 2, top: node.y - node.height / 2, width: node.width, height: node.height }} disabled={disabled} aria-label={`${label} access`} aria-pressed={tab ? connected : free.length ? (all ? true : count > 0 ? "mixed" : false) : connected} aria-describedby={`${centerPanelId}-${node.id}-tooltip`} onClick={(event) => { if (!disabled) { if (event?.currentTarget) pulseNode(event.currentTarget); onChange(tab ? [tab.key] : free.map((tab) => tab.key), next); } }}>
                {nodeDisplay !== 2 && <span className="portal-flow-icon"><Icon size={48} aria-hidden="true" /></span>}
                {nodeDisplay !== 1 && <span className="portal-flow-caption">{isGroup && group.section && <small>{group.section}</small>}<strong>{tab?.label ?? name}</strong></span>}
                <span id={`${centerPanelId}-${node.id}-tooltip`} role="tooltip" className="portal-flow-tooltip"><strong>{label}</strong><span>{`Turn ${next ? "on" : "off"} access`}</span></span>
              </button>;
            })}
          </div>
        </div>
        <aside id={centerPanelId} className={`portal-flow-details${infoPinned || (infoVisible && !panning) ? " is-visible" : ""}${!hoveredGroup ? " is-center" : ""}${infoPinned ? " is-pinned" : ""}`} aria-hidden={!infoPinned && (!infoVisible || panning)} aria-label="Node details" onWheelCapture={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape" && !event.defaultPrevented) { setInfoPinned(false); setInfoVisible(false); } event.stopPropagation(); }} style={branchStyle(hoveredGroup?.label ?? hoveredGroup?.tabs[0].label ?? "Dashboard")}>
          {!hoveredGroup && <button type="button" className="portal-flow-details-close" aria-label="Close node details" onClick={() => { setInfoPinned(false); setInfoVisible(false); }}><X size={16} aria-hidden="true" /></button>}
          <small className="portal-flow-details-eyebrow">{!hoveredGroup ? "Access level" : hoveredTab ? "Subtab" : "Main tab"}</small>
          <HoverIcon size={36} aria-hidden="true" />
          <h2>{hoveredName}</h2>
          {hoveredGroup?.section && <p className="portal-flow-details-family">{[hoveredGroup.section, ...(hoveredTab ? [hoveredGroup.label] : [])].filter(Boolean).join(" · ")}</p>}
          <span className={`portal-flow-details-status${hoveredEnabled ? " is-on" : ""}`}>{!hoveredGroup ? "Access hub" : !hoveredEnabled ? "Access off" : hoveredEnabled === hoveredTabs.length ? "Access on" : "Partial access"}</span>
          {!hoveredGroup && <div className="portal-flow-role-controls">{renderCenterPanel?.(canvasTools) ?? canvasTools}</div>}
          <dl><div><dt>Account level</dt><dd>{levelName}</dd></div><div><dt>Permission</dt><dd>{!hoveredGroup ? "Central access hub" : "Click node to toggle"}</dd></div></dl>
          {!hoveredTab && hoveredTabs.length > 0 && <div className="portal-flow-details-tabs"><h3>Subtabs</h3>{hoveredTabs.map(tab => <div key={tab.key}><span>{tab.label}</span><small>{open.has(tab.key) ? "On" : "Off"}</small></div>)}</div>}
        </aside>
      </div>
    </div>
  );
}
