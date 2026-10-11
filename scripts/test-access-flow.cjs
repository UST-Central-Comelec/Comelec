// Run with: node scripts/test-access-flow.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Test geometry and pointer gestures without Next.js or a browser. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
function load(file, dependencies = {}, timerApi = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", "setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", source)(name => dependencies[name] ?? require(name), compiled, compiled.exports, timerApi.setTimeout ?? setTimeout, timerApi.clearTimeout ?? clearTimeout, timerApi.requestAnimationFrame, timerApi.cancelAnimationFrame);
  return compiled.exports;
}
const { accessTabGroups: tabGroups } = load("src/lib/portal/access.ts");
const geometry = load("src/components/portal/access-flow-layout.ts");
for (const groups of [tabGroups, tabGroups.map(group => ({ ...group, tabs: group.tabs.map((tab, index) => ({ ...tab, label: index === 0 ? `${tab.label} and additional commission records` : tab.label })) }))]) {
  const layout = geometry.createFlowLayout(groups);
  const root = layout.nodes[0];
  const tabNode = layout.nodes[1];
  for (const node of layout.nodes.slice(1)) {
    assert.equal(node.width, tabNode.width, "Main tabs and subtabs share one card width");
    assert.equal(node.height, tabNode.height, "Main tabs and subtabs share one card height");
  }
  for (const [axis, direction] of [["x", -1], ["x", 1], ["y", -1], ["y", 1]]) assert.ok(layout.nodes.some(node => node.groupIndex >= 0 && (node[axis] - root[axis]) * direction > 100), "Branches surround the center in every direction");
  assert.ok(Math.abs(root.x - layout.width / 2) < layout.width * .08 && Math.abs(root.y - layout.height / 2) < layout.height * .08, "Hub sits in the center of the radial layout");
  assert.equal(layout.width, layout.height, "Radial canvas is circular and centered");
  assert.ok(layout.edges.filter(edge => edge.path.includes(" A")).length > 10, "Branches follow curved circular orbits");
  assert.equal(layout.nodes.length, 1 + groups.length + groups.filter(group => group.label).flatMap(group => group.tabs).length);
  for (let i = 0; i < layout.nodes.length; i++) {
    const node = layout.nodes[i];
    assert.ok(node.x - node.width / 2 > 0 && node.x + node.width / 2 < layout.width);
    assert.ok(node.y - node.height / 2 > 0 && node.y + node.height / 2 < layout.height);
    for (const other of layout.nodes.slice(i + 1)) assert.equal(geometry.nodesOverlap(node, other, 28), false, `${node.id} must have space around ${other.id}`);
  }
  // Independent segment/rectangle clipping checks every line against complete icon + label cards.
  for (const edge of layout.edges) {
    assert.ok(!/NaN|Infinity/.test(edge.path));
    for (const node of layout.nodes) {
      if (node.id === edge.from.id || node.id === edge.to.id) continue;
      const left = node.x - node.width / 2 - 16, right = node.x + node.width / 2 + 16;
      const top = node.y - node.height / 2 - 16, bottom = node.y + node.height / 2 + 16;
      for (let segment = 1; segment < edge.points.length; segment++) {
      const startPoint = edge.points[segment - 1], endPoint = edge.points[segment];
      let first = 0, last = 1;
      for (const [start, end, min, max] of [[startPoint.x, endPoint.x, left, right], [startPoint.y, endPoint.y, top, bottom]]) {
        const delta = end - start;
        if (delta === 0) { if (start < min || start > max) { first = 2; break; } }
        else { const a = (min - start) / delta, b = (max - start) / delta; first = Math.max(first, Math.min(a, b)); last = Math.min(last, Math.max(a, b)); }
      }
      assert.ok(first > last, `${edge.to.id} wire must clear ${node.id}, including labels`);
      }
    }
  }
  for (let i = 0; i < layout.edges.length; i++) for (const other of layout.edges.slice(i + 1)) assert.equal(geometry.edgesCross(layout.edges[i], other), false);
}
const timerCallbacks = new Map(), frameCallbacks = new Map(), panStyle = new Map();
const panStage = { style: { setProperty: (name, value) => panStyle.set(name, value) } };
const paintFrame = () => { const callbacks = [...frameCallbacks.values()]; frameCallbacks.clear(); callbacks.forEach(callback => callback()); };
let timerId = 0;
const panCleanups = [];
const cleanup = () => panCleanups.forEach(callback => callback());
const states = [];
const { useCanvasPan, boundedPan } = load("src/components/portal/use-canvas-pan.ts", {
  react: {
    useRef: value => ({ current: value }),
    useState: initial => { const index = states.length; states.push(initial); return [initial, value => { states[index] = value; }]; },
    useEffect: callback => { const stop = callback(); if (stop) panCleanups.push(stop); },
  },
}, { setTimeout: callback => { timerCallbacks.set(++timerId, callback); return timerId; }, clearTimeout: id => timerCallbacks.delete(id), requestAnimationFrame: callback => { frameCallbacks.set(++timerId, callback); return timerId; }, cancelAnimationFrame: id => frameCallbacks.delete(id) });
assert.equal(boundedPan(10000, 1000, 600, true), 100, "Pan stops at the diagram's 10% leading margin");
assert.equal(boundedPan(-10000, 1000, 600, true), -500, "Pan stops at the diagram's 10% trailing margin");
assert.equal(boundedPan(-200, 1000, 600, true), -200, "Panning inside the bounds stays unchanged");
assert.equal(boundedPan(10000, 500, 300, true), 50, "The margin scales with zoom");
assert.equal(boundedPan(-10000, 1000, 1300, true), 0, "An oversized viewport keeps the diagram centered");
assert.equal(boundedPan(10000, 1000, 1100, true), 50, "Auto-centering is included in pan bounds");
let captured = null;
const gridStyle = new Map();
const target = { style: { setProperty: (name, value) => gridStyle.set(name, value) }, setPointerCapture: id => { captured = id; }, hasPointerCapture: id => captured === id, releasePointerCapture: () => { captured = null; } };
const { handlers, resetPan } = useCanvasPan({ current: target }, { current: panStage });
const event = (extra = {}) => ({ detail: 1, pointerId: 1, isPrimary: true, button: 0, clientX: 100, clientY: 100, currentTarget: target, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra });
handlers.onPointerDownCapture(event()); handlers.onPointerUp();
assert.equal(timerCallbacks.size, 0, "A short click cancels the hold timer");
const shortClick = event(); handlers.onClickCapture(shortClick); assert.ok(!shortClick.prevented, "Short clicks still toggle nodes");
handlers.onPointerDownCapture(event()); handlers.onPointerMove(event({ clientX: 120 }));
assert.equal(timerCallbacks.size, 0, "Moving before the hold threshold starts dragging and clears the timer");
assert.equal(states[0], true); assert.deepEqual(states[1], { x: 0, y: 0 }, "Dragging does not re-render the graph per pointer event");
handlers.onPointerMove(event({ clientX: 150, clientY: 125 }));
assert.equal(frameCallbacks.size, 1, "Multiple pointer events share a single animation frame");
paintFrame();
assert.equal(panStyle.get("--canvas-pan-x"), "50px");
assert.equal(panStyle.get("--canvas-pan-y"), "25px");
assert.equal(gridStyle.get("--canvas-pan-x"), "50px");
assert.equal(gridStyle.get("--canvas-pan-y"), "25px", "Dot grid and graph share the same pan transform");
assert.deepEqual(states[1], { x: 0, y: 0 }, "Painting a frame does not re-render the graph");
handlers.onPointerUp();
assert.deepEqual(states[1], { x: 50, y: 25 }, "Release commits the final pan offset");
const movementClick = event(); handlers.onClickCapture(movementClick); assert.ok(movementClick.prevented);
resetPan();
handlers.onPointerDownCapture(event()); const hold = [...timerCallbacks.values()][0]; hold();
assert.equal(states[0], true); assert.equal(captured, 1);
handlers.onPointerMove(event({ clientX: 140, clientY: 65 }));
assert.equal(frameCallbacks.size, 1);
handlers.onPointerUp(); assert.deepEqual(states[1], { x: 40, y: -35 }); assert.equal(frameCallbacks.size, 0, "Release flushes and cancels the pending frame"); assert.equal(panStyle.get("--canvas-pan-x"), "40px"); assert.equal(states[0], false); assert.equal(captured, null);
const keyboardClick = event({ detail: 0 }); handlers.onClickCapture(keyboardClick); assert.ok(!keyboardClick.prevented, "Keyboard activation remains available after a drag");
const dragClick = event(); handlers.onClickCapture(dragClick); assert.ok(dragClick.prevented && dragClick.stopped, "Dragging must not toggle a node");
resetPan(); assert.deepEqual(states[1], { x: 0, y: 0 }, "Fit restores the pan origin");
handlers.onPointerDownCapture(event()); handlers.onPointerCancel(); assert.equal(timerCallbacks.size, 0);
handlers.onPointerDownCapture(event({ isPrimary: false })); assert.equal(timerCallbacks.size, 0, "Secondary touch must not start a drag");
handlers.onPointerDownCapture(event()); cleanup(); assert.equal(timerCallbacks.size, 0, "Unmount cancels outstanding hold timers");
const listeners = new Map(), zoomCleanups = [], zoomFrames = new Map();
let zoomFrameId = 0;
const stepZoom = () => { const callbacks = [...zoomFrames.values()]; zoomFrames.clear(); callbacks.forEach(callback => callback()); };
const finishZoom = () => { for (let i = 0; zoomFrames.size && i < 100; i++) stepZoom(); assert.equal(zoomFrames.size, 0, "Zoom animation settles"); };
const zoomApi = load("src/components/portal/use-canvas-zoom.ts", { react: { useRef: value => ({ current: value }), useEffect: callback => { const cleanup = callback(); if (cleanup) zoomCleanups.push(cleanup); }, useLayoutEffect: callback => callback() } }, { requestAnimationFrame: callback => { zoomFrames.set(++zoomFrameId, callback); return zoomFrameId; }, cancelAnimationFrame: id => zoomFrames.delete(id) });
assert.ok(zoomApi.wheelZoom(.5, -100, 0, 500, false) > .5);
assert.ok(zoomApi.wheelZoom(.5, 100, 0, 500, false) < .5);
assert.equal(zoomApi.wheelZoom(1.5, -100, 0, 500, true), 1.5);
assert.equal(zoomApi.wheelZoom(.4, 1000, 0, 500, false, .35), .35);
assert.equal(zoomApi.wheelZoom(.05, 100, 0, 500, true), .05);
assert.equal(zoomApi.wheelZoom(.5, 1, 1, 500, false), zoomApi.wheelZoom(.5, 16, 0, 500, false));
const zoomClasses = new Set();
const surface = { classList: { add: name => zoomClasses.add(name), remove: name => zoomClasses.delete(name) }, clientWidth: 800, clientHeight: 600, clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0, getBoundingClientRect: () => ({ left: 20, top: 40 }), addEventListener: (name, callback, options) => { assert.equal(options.passive, false); listeners.set(name, callback); }, removeEventListener: name => listeners.delete(name) };
let scale = .5, pan = { x: 25, y: -10 };
const zoomControls = zoomApi.useCanvasZoom({ current: surface }, { current: {} }, { zoom: scale, minZoom: .3, offset: pan, width: 1000, height: 700, onZoom: value => { scale = value; }, onPan: value => { pan = value; } });
const cursor = { x: 310, y: 230 };
const underCursor = () => ({ x: (cursor.x - 20 - Math.max(0, (800 - 1000 * scale) / 2) - pan.x) / scale, y: (cursor.y - 40 - pan.y) / scale });
const anchor = underCursor();
const zoomEvent = extra => ({ deltaY: -30, deltaMode: 0, ctrlKey: false, clientX: cursor.x, clientY: cursor.y, preventDefault() { this.prevented = true; }, ...extra });
for (let i = 0; i < 8; i++) { const event = zoomEvent({ ctrlKey: i % 2 === 0 }); listeners.get("wheel")(event); assert.ok(event.prevented); }
assert.equal(scale, .5, "Wheel bursts do not immediately change scale");
assert.equal(zoomFrames.size, 1, "Wheel bursts share one animation frame");
assert.ok(zoomClasses.has("is-zooming"), "Decorative animation pauses during zoom gestures");
stepZoom();
assert.ok(scale > .5 && scale < 1.5, "Zoom eases toward the requested scale");
finishZoom();
assert.ok(scale > .5);
assert.ok(Math.abs(underCursor().x - anchor.x) < 1e-8 && Math.abs(underCursor().y - anchor.y) < 1e-8, "Rapid wheel/pinch zoom preserves cursor anchoring across centered margins");
listeners.get("gesturestart")(zoomEvent()); const startScale = scale;
listeners.get("gesturechange")(zoomEvent({ scale: .8 })); finishZoom(); assert.ok(Math.abs(scale - startScale * .8) < 1e-8);
listeners.get("gesturechange")(zoomEvent({ scale: .7 })); finishZoom(); assert.ok(Math.abs(scale - startScale * .7) < 1e-8, "Safari pinch uses cumulative gesture scale");
listeners.get("gesturechange")(zoomEvent({ scale: .001 })); finishZoom();
assert.equal(scale, .3, "Pinching stops at the 30% limit");
listeners.get("gestureend")(zoomEvent());
const panAtLimit = { ...pan };
listeners.get("wheel")(zoomEvent({ deltaY: 10000 }));
assert.equal(zoomFrames.size, 0, "Scrolling at 30% does not schedule redundant animation frames");
assert.ok(!zoomClasses.has("is-zooming"), "Scrolling at 30% does not pause decorative animations");
finishZoom();
assert.equal(scale, .3, "Mouse scrolling stops at the 30% limit");
listeners.get("wheel")(zoomEvent({ deltaY: 10000, ctrlKey: true }));
assert.equal(zoomFrames.size, 0, "Pinching at 30% does not schedule redundant animation frames");
assert.ok(!zoomClasses.has("is-zooming"), "Pinching at 30% does not pause decorative animations");
finishZoom();
assert.equal(scale, .3, "Trackpad pinch stops at the 30% limit");
assert.deepEqual(pan, panAtLimit, "Further zoom-out attempts do not move the diagram");
zoomControls.zoomTo(.8);
assert.equal(zoomFrames.size, 1, "Ribbon zoom uses the same animation loop");
stepZoom();
const scaleAtCancel = scale;
zoomControls.cancel(); finishZoom();
assert.equal(scale, scaleAtCancel, "Fit/pan cancellation stops unfinished zoom movement");
assert.ok(!zoomClasses.has("is-zooming"), "Cancelling zoom resumes decorative animation");
zoomControls.zoomTo(1); assert.equal(zoomFrames.size, 1);
zoomCleanups.forEach(cleanup => cleanup()); assert.equal(listeners.size, 0);
assert.equal(zoomFrames.size, 0, "Unmount cancels pending zoom frames");
assert.ok(!zoomClasses.has("is-zooming"), "Unmount clears the zoom animation state");
const React = require("react");
const Icon = () => null;
const icons = new Proxy({}, { get: () => Icon });
const { AccessFlowMap } = load("src/components/portal/access-flow-map.tsx", {
  react: { ...React, useId: () => "test-center-panel", useEffect: () => {}, useMemo: callback => callback(), useRef: () => ({ current: null }), useState: initial => [initial, () => {}] },
  "./portal-nav-icons": { ShieldCheck: Icon }, "./portal-tab-icons": { groupIcons: icons, tabIcons: icons },
  "./access-flow-layout": geometry, "./use-canvas-zoom": { useCanvasZoom: () => ({ zoomTo: () => {}, cancel: () => {} }) }, "./use-canvas-pan": { useCanvasPan: () => ({ panning: false, getOffset: () => ({ x: 0, y: 0 }), resetPan: () => {}, handlers: {} }) },
});
const groups = tabGroups.map(group => ({ ...group, tabs: group.tabs.map(tab => ({ ...tab, fixed: tab.key === "documents/approval", on: true, byDefault: true, boardOnly: tab.key === "documents/approval", centralOnly: !tab.local })) }));
const open = new Set(groups.flatMap(group => group.tabs.filter(tab => !tab.fixed).map(tab => tab.key)));
const props = { groups, open, levelName: "Deputies", locked: false, disabled: false, onChange: (keys, on) => keys.forEach(key => on ? open.add(key) : open.delete(key)) };
function walk(node) { if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(walk); return [node, ...walk(node.props?.children)]; }
const render = () => walk(AccessFlowMap(props));
const button = label => render().find(node => node.type === "button" && node.props["aria-label"] === label);
const pulses = () => render().filter(node => node.props?.className === "portal-flow-wire is-connected").length;
const groupCards = render().filter(node => node.type === "button" && node.props.className?.includes("is-group"));
assert.equal(new Set(groupCards.map(node => node.props.style["--flow-rgb"])).size, groups.length, "Each main tab has a distinct color");
for (const card of groupCards) {
  const groupName = card.props["aria-label"].replace(/ access$/, "");
  for (const child of render().filter(node => node.type === "button" && node.props["aria-label"]?.startsWith(`${groupName}: `))) assert.equal(child.props.style["--flow-rgb"], card.props.style["--flow-rgb"], "Subtabs inherit their main tab color");
}
const initialPulses = pulses();
const batches = render().find(node => node.type?.name === "FlowBeams").props.batches;
assert.ok(batches.every(batch => batch.length >= 4 && batch.length <= 5), "Full canvas releases balanced batches of four or five beams");
assert.equal(new Set(batches.flat().map(edge => edge.to.id)).size, initialPulses, "Every active connection receives one beam per cycle");
assert.ok(batches[0].every(edge => edge.from.id === "root"), "Flow starts at the center");
button("Secretariat: Calendar access").props.onClick(); assert.equal(open.has("secretariat/calendar"), false); assert.equal(pulses(), initialPulses - 1);
button("Secretariat: Calendar access").props.onClick(); assert.equal(open.has("secretariat/calendar"), true); assert.equal(pulses(), initialPulses);
button("Apps access").props.onClick(); assert.ok(open.has("secretariat/calendar") && !open.has("apps/inbox"));
button("Apps access").props.onClick(); assert.ok(open.has("secretariat/calendar") && open.has("apps/inbox"));
assert.ok(!open.has("documents/approval") && open.has("documents/archive"), "Toggling Apps leaves Legal document access alone");
button("Legals access").props.onClick(); assert.ok(open.has("documents/approval") && open.has("documents/archive"));
button("Legals access").props.onClick(); assert.ok(!open.has("documents/approval") && !open.has("documents/archive"));
button("Legals access").props.onClick(); assert.ok(open.has("documents/approval") && open.has("documents/archive"));
assert.equal(button("Legals: Documents → Approval access").props.disabled, false);
button("Legals: Documents → Approval access").props.onClick(); assert.equal(open.has("documents/approval"), false);
assert.ok(!fs.readFileSync("src/components/portal/access-flow-map.tsx", "utf8").includes("Click an icon to turn access on or off"));
const { renderToStaticMarkup } = require("react-dom/server");
const serverDiagram = renderToStaticMarkup(AccessFlowMap(props));
const originalSin = Math.sin, originalCos = Math.cos;
try {
  // Model the last-digit trig differences seen between server and browser engines.
  Math.sin = angle => originalSin(angle) * (1 + Number.EPSILON);
  Math.cos = angle => originalCos(angle) * (1 - Number.EPSILON);
  assert.equal(renderToStaticMarkup(AccessFlowMap(props)), serverDiagram, "Diagram markup matches across tiny engine differences in trigonometry");
} finally {
  Math.sin = originalSin;
  Math.cos = originalCos;
}
let pathname = "/portal/accounts/access-control";
const { PortalNav, trail } = load("src/components/portal/portal-nav.tsx", {
  "next/link": { default: props => React.createElement("a", props) },
  "next/navigation": { usePathname: () => pathname },
  "motion/react": { LayoutGroup: props => props.children, motion: { div: ({ children, className, "aria-label": label }) => React.createElement("div", { className, "aria-label": label }, children), nav: ({ children, className, "aria-label": label }) => React.createElement("nav", { className, "aria-label": label }, children), span: ({ className }) => React.createElement("span", { className }) }, useReducedMotion: () => true },
  "./portal-nav-icons": icons,
  "./portal-tab-icons": { groupIcons: icons, tabIcons: icons },
  "@/lib/portal/access": load("src/lib/portal/access.ts"),
});
const allTabs = groups.flatMap(group => group.tabs.map(tab => tab.key));
const boardNav = renderToStaticMarkup(React.createElement(PortalNav, { tabs: allTabs, collapsed: false, showAccessControl: true }));
assert.ok(boardNav.indexOf('href="/portal/accounts"') < boardNav.indexOf('href="/portal/accounts/access-control"') && boardNav.indexOf('href="/portal/accounts/access-control"') < boardNav.indexOf('href="/portal/maintenance"'), "Access Control appears directly below Accounts");
assert.equal((boardNav.match(/aria-current="page"/g) ?? []).length, 1, "Only Access Control is active on its page");
assert.match(boardNav, /href="\/portal\/accounts\/access-control"[^>]*aria-current="page"/);
assert.deepEqual(trail(pathname).map(crumb => crumb.label), ["Administrative", "Access Control"]);
const memberNav = renderToStaticMarkup(React.createElement(PortalNav, { tabs: allTabs, collapsed: false, showAccessControl: false }));
assert.ok(!memberNav.includes('href="/portal/accounts/access-control"'), "Board-only access remains restricted in navigation");
pathname = "/portal/accounts/expiration";
assert.deepEqual(trail(pathname).map(crumb => crumb.label), ["Administrative", "Accounts", "Expiration"]);
console.log("Access flow passed: content-sized branches, icon/label clearance, uncrossed lines, bounds, mouse/touch pan, click safety, wheel/pinch zoom, cursor anchoring, limits, and Fit reset.");
