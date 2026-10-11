const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const access = load("src/lib/portal/access.ts");
let pathname = "/portal";
let state;
let expanded = 0;
const Icon = () => null;
const icons = new Proxy({}, { get: () => Icon });
const { PortalNav, trail } = load("src/components/portal/portal-nav.tsx", {
  react: { ...React, useState: initial => { state ??= initial; return [state, next => { state = typeof next === "function" ? next(state) : next; }]; }, useId: () => "navigation-test", useRef: () => ({ current: null }) },
  "next/navigation": { usePathname: () => pathname },
  "next/link": { default: "a" },
  "motion/react": { LayoutGroup: "div", motion: { nav: "nav", div: "div", span: "span" }, useReducedMotion: () => true },
  "./portal-nav-icons": icons,
  "./portal-tab-icons": { groupIcons: icons, tabIcons: icons },
  "@/lib/portal/access": access,
});
const props = { tabs: ["dashboard", "charters/constitution", "charters/elections-code", "documents/archive", "accounts"], collapsed: false, showAccessControl: false, onExpand: () => expanded++ };
function walk(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(walk);
  return [node, ...walk(node.props?.children)];
}
const render = () => walk(PortalNav(props));
const button = label => render().find(node => node.type === "button" && node.props["aria-label"] === label);
const input = () => render().find(node => node.type === "input");
const links = () => render().filter(node => node.props?.tab).map(node => node.props.tab.key);
const originalFrame = global.requestAnimationFrame;
global.requestAnimationFrame = callback => callback();
try {
  const root = render();
  assert.ok(root.findIndex(node => node.type === "input") < root.findIndex(node => node.props?.tab?.key === "dashboard"), "Search precedes Dashboard");
  button("Open Legals tabs").props.onClick();
  button("Open Charters tabs").props.onClick();
  assert.deepEqual(links(), ["charters/constitution", "charters/elections-code"], "Legal subgroups expand their tabs inline");
  assert.ok(button("Open Documents tabs"), "Sibling legal groups remain in the Legals panel");
  assert.equal(button("Open Charters tabs").props["aria-expanded"], true);
  button("Open Documents tabs").props.onClick();
  assert.deepEqual(links(), ["documents/archive", "charters/constitution", "charters/elections-code"], "Multiple legal groups can be expanded together");
  button("Open Charters tabs").props.onClick();
  assert.equal(button("Open Charters tabs").props["aria-expanded"], false);
  assert.deepEqual(links(), ["documents/archive"], "Collapsing one group leaves its sibling open");
  button("Back to all tabs").props.onClick();
  assert.deepEqual(links(), ["dashboard"]);
  assert.ok(button("Open Legals tabs"));
  assert.equal(pathname, "/portal", "Panel browsing does not change the page");
  input().props.onChange({ target: { value: "Legals constitution" } });
  assert.deepEqual(links(), ["charters/constitution"], "Search matches both section and subtab labels");
  input().props.onChange({ target: { value: "Magna Carta" } });
  assert.deepEqual(links(), [], "Search never exposes tabs the account cannot open");
  input().props.onChange({ target: { value: "access control" } });
  assert.deepEqual(links(), []);
  props.showAccessControl = true;
  assert.deepEqual(links(), ["access-control"], "Access Control uses its separate authorization flag");
  input().props.onKeyDown({ key: "Escape" });
  assert.equal(input().props.value, "");
  pathname = "/portal/charters/elections-code/edit";
  assert.deepEqual(links(), ["charters/constitution", "charters/elections-code"], "Navigation opens Legals and expands the active subgroup");
  assert.deepEqual(trail(pathname).map(item => item.label), ["Legals", "Charters", "Elections Code", "Edit"]);
  props.collapsed = true;
  assert.ok(button("Back to all tabs"), "Collapsed Legals retains back navigation");
  assert.equal(input(), undefined);
  button("Search navigation").props.onClick();
  assert.equal(expanded, 1, "Search opens the collapsed sidebar");
  props.tabs = ["dashboard"];
  assert.deepEqual(links(), ["dashboard"], "Removing access drops the old panel immediately");
  pathname = "/portal";
  props.collapsed = false;
  props.tabs = ["dashboard", "recruitment/applications", "recruitment/settings"];
  props.counts = { "recruitment/applications": 1 };
  const recruitment = button("Open Recruitment tabs, 1 items needing attention");
  assert.ok(recruitment, "Recruitment announces the unread applicant count");
  recruitment.props.onClick();
  assert.equal(render().find(node => node.props?.tab?.key === "recruitment/applications").props.count, 1, "Applicants receives the same unread count");
  button("Back to all tabs").props.onClick();
  props.tabs = ["dashboard", "documents/approval", "documents/archive", "legals/onboarding", "accounts", "apps/inbox"];
  props.counts = { "documents/approval": 2, "documents/archive": 1, accounts: 4, "apps/inbox": 3, "charters/constitution": 99 };
  assert.ok(button("Open Legals tabs, 1 items needing attention"), "Parents exclude removed Approval from their counts");
  button("Open Legals tabs, 1 items needing attention").props.onClick();
  assert.ok(button("Open Documents tabs, 1 items needing attention"));
  assert.ok(!links().includes("legals/onboarding"), "Onboarding stays inside the collapsed Documents group");
  button("Open Documents tabs, 1 items needing attention").props.onClick();
  assert.ok(links().includes("legals/onboarding"), "Onboarding appears under Documents");
  assert.ok(!links().includes("documents/approval"), "Approval stays out of Documents even with permission");
  assert.ok(links().includes("documents/archive"), "Archive remains available");
  assert.deepEqual(trail("/portal/legals/onboarding").map(item => item.label), ["Legals", "Documents", "Onboarding"]);
  button("Back to all tabs").props.onClick();
  assert.ok(button("Open Apps tabs, 3 items needing attention"));
  assert.ok(button("Open Administrative tabs, 4 items needing attention"));
  input().props.onChange({ target: { value: "inbox" } });
  assert.equal(render().find(node => node.props?.tab?.key === "apps/inbox").props.count, 3, "Search retains other tabs' badges");
  input().props.onKeyDown({ key: "Escape" });
  props.tabs = ["dashboard", "events", "members", "news", "secretariat/calendar", "secretariat/letters-tracker", "secretariat/minutes", "secretariat/surveys"];
  props.counts = { events: 2 };
  button("Open Secretariat tabs, 2 items needing attention").props.onClick();
  assert.deepEqual(links(), ["events", "secretariat/letters-tracker", "members", "secretariat/calendar", "secretariat/minutes", "news", "secretariat/surveys"], "Secretariat includes Surveys after its existing tabs");
  assert.equal(render().find(node => node.props?.tab?.key === "news").props.tab.label, "Publications");
  assert.deepEqual(trail("/portal/events/example/rsvp").map(item => item.label), ["Secretariat", "Events", "Details", "RSVP Form"]);
  assert.deepEqual(trail("/portal/secretariat/calendar").map(item => item.label), ["Secretariat", "Calendar"]);
  assert.deepEqual(trail("/portal/secretariat/surveys").map(item => item.label), ["Secretariat", "Surveys"]);
  button("Back to all tabs").props.onClick();
  assert.ok(render().some(node => node.props?.children === "Committee"));
  assert.ok(!button("Open Publications tabs"));
  console.log("Sidebar panel checks passed: replacement, back navigation, search, permissions, route changes, and collapsed controls.");
} finally {
  if (originalFrame === undefined) delete global.requestAnimationFrame;
  else global.requestAnimationFrame = originalFrame;
}
