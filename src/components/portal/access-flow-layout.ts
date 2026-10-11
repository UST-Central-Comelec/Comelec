import type { AccessGroup } from "./access-control-form";

export type FlowNode = { id: string; x: number; y: number; width: number; height: number; groupIndex: number; tabIndex?: number };
type Point = { x: number; y: number };
// Keep rendered geometry identical across JavaScript engines' trig implementations.
export const flowCoordinate = (value: number) => Number(value.toFixed(3));
export type FlowEdge = { points: Point[]; from: FlowNode; to: FlowNode; start: { x: number; y: number }; end: { x: number; y: number }; path: string };

const bounds = (node: FlowNode, gap = 0) => ({ left: node.x - node.width / 2 - gap, right: node.x + node.width / 2 + gap, top: node.y - node.height / 2 - gap, bottom: node.y + node.height / 2 + gap });

export function nodesOverlap(a: FlowNode, b: FlowNode, gap = 16) {
  const x = bounds(a, gap / 2), y = bounds(b, gap / 2);
  return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
}

export function flowEdge(from: FlowNode, to: FlowNode, points: Point[]): FlowEdge {
  return { from, to, points, start: points[0], end: points[points.length - 1], path: points.map((point, index) => `${index ? "L" : "M"}${flowCoordinate(point.x)} ${flowCoordinate(point.y)}`).join(" ") };
}

/** Segment/rectangle clipping includes the entire icon and label card, with clearance around it. */
export function edgeHitsNode(edge: FlowEdge, node: FlowNode, gap = 12) {
  if (node.id === edge.from.id || node.id === edge.to.id) return false;
  const box = bounds(node, gap);
  return edge.points.slice(1).some((end, index) => {
    const start = edge.points[index];
    let enter = 0, leave = 1;
    const dx = end.x - start.x, dy = end.y - start.y;
    for (const [p, q] of [[-dx, start.x - box.left], [dx, box.right - start.x], [-dy, start.y - box.top], [dy, box.bottom - start.y]]) {
      if (p === 0) { if (q < 0) return false; }
      else {
        const ratio = q / p;
        if (p < 0) enter = Math.max(enter, ratio); else leave = Math.min(leave, ratio);
        if (enter > leave) return false;
      }
    }
    return true;
  });
}

export function edgesCross(a: FlowEdge, b: FlowEdge) {
  if (a.from.id === b.from.id || a.from.id === b.to.id || a.to.id === b.from.id || a.to.id === b.to.id) return false;
  return a.points.slice(1).some((endA, i) => b.points.slice(1).some((endB, j) => {
    const startA = a.points[i], startB = b.points[j];
    const turn = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return turn(startA, endA, startB) * turn(startA, endA, endB) < 0 && turn(startB, endB, startA) * turn(startB, endB, endA) < 0;
  }));
}

function boundary(from: FlowNode, toward: Point) {
  const dx = toward.x - from.x, dy = toward.y - from.y;
  const factor = Math.min(dx === 0 ? Infinity : from.width / 2 / Math.abs(dx), dy === 0 ? Infinity : from.height / 2 / Math.abs(dy));
  return { x: from.x + dx * factor, y: from.y + dy * factor };
}

/** Concentric radial orbits with curved connectors inside each tab family's sector. */
export function createFlowLayout(groups: AccessGroup[]) {
  const nodeWidth = 160, nodeHeight = 140;
  const weights = groups.map(group => group.label ? group.tabs.length * (nodeWidth + 40) : 200);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  for (let radius = 560; radius <= 3600; radius += 40) {
    const root: FlowNode = { id: "root", x: 0, y: 0, width: 200, height: 200, groupIndex: -1 };
    const nodes: FlowNode[] = [root], edges: FlowEdge[] = [];
    const sectors: { groupIndex: number; start: number; end: number }[] = [];
    let used = 0;
    groups.forEach((group, groupIndex) => {
      const start = -Math.PI / 2 + used / total * Math.PI * 2;
      const span = weights[groupIndex] / total * Math.PI * 2;
      used += weights[groupIndex];
      sectors.push({ groupIndex, start: start + .04, end: start + span - .04 });
      const angle = start + span / 2;
      const parent: FlowNode = { id: `group:${groupIndex}`, x: Math.cos(angle) * radius * .52, y: Math.sin(angle) * radius * .52, width: nodeWidth, height: nodeHeight, groupIndex };
      nodes.push(parent);
      edges.push(flowEdge(root, parent, [boundary(root, parent), boundary(parent, root)]));
      if (!group.label) return;
      const content = group.tabs.map(() => nodeWidth + 40);
      const sum = content.reduce((sum, value) => sum + value, 0);
      let occupied = 0;
      group.tabs.forEach((tab, tabIndex) => {
        const leafAngle = start + span * (.08 + .84 * (occupied + content[tabIndex] / 2) / sum);
        occupied += content[tabIndex];
        const child: FlowNode = { id: `tab:${tab.key}`, x: Math.cos(leafAngle) * radius, y: Math.sin(leafAngle) * radius, width: nodeWidth, height: nodeHeight, groupIndex, tabIndex };
        nodes.push(child);
        const orbit = radius * .76;
        const samples = Array.from({ length: 25 }, (_, i) => {
          const arcAngle = angle + (leafAngle - angle) * i / 24;
          return { x: Math.cos(arcAngle) * orbit, y: Math.sin(arcAngle) * orbit };
        });
        const edge = flowEdge(parent, child, [boundary(parent, samples[0]), ...samples, boundary(child, samples[samples.length - 1])]);
        edges.push(edge);
      });
    });
    if (nodes.some((node, i) => nodes.slice(i + 1).some(other => nodesOverlap(node, other, 28)))) continue;
    if (edges.some(edge => nodes.some(node => edgeHitsNode(edge, node, 16)))) continue;
    if (edges.some((edge, i) => edges.slice(i + 1).some(other => edgesCross(edge, other)))) continue;
    const center = Math.ceil(radius + Math.max(...nodes.map(node => node.width / 2)) + 64);
    nodes.forEach(node => { node.x = flowCoordinate(node.x + center); node.y = flowCoordinate(node.y + center); });
    edges.forEach(edge => {
      edge.points.forEach(point => { point.x = flowCoordinate(point.x + center); point.y = flowCoordinate(point.y + center); });
      if (edge.to.tabIndex === undefined) {
        edge.path = `M${edge.start.x} ${edge.start.y} L${edge.end.x} ${edge.end.y}`;
      } else {
        const first = edge.points[1], last = edge.points[edge.points.length - 2];
        const a = edge.points[2], b = edge.points[1];
        const sweep = (b.x - center) * (a.y - center) - (b.y - center) * (a.x - center) >= 0 ? 1 : 0;
        edge.path = Math.hypot(first.x - last.x, first.y - last.y) < .01
          ? `M${edge.start.x} ${edge.start.y} L${edge.end.x} ${edge.end.y}`
          : `M${edge.start.x} ${edge.start.y} L${first.x} ${first.y} A${radius * .76} ${radius * .76} 0 0 ${sweep} ${last.x} ${last.y} L${edge.end.x} ${edge.end.y}`;
      }
    });
    return { width: center * 2, height: center * 2, center, radius, sectors, nodes, edges };
  }
  throw new Error("Access diagram could not find a clear radial layout.");
}
