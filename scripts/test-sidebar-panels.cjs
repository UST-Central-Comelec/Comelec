/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable -- Standalone CommonJS test runner. */
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
let searchParams = new URLSearchParams();
let state;
let expanded = 0;
const Icon = () => null;
const icons = new Proxy({}, { get: () => Icon });
const { PortalNav, trail } = load("src/components/portal/portal-nav.tsx", {
  react: { ...React, useState: initial => { state ??= initial; return [state, next => { state = typeof next === "function" ? next(state) : next; }]; }, useId: () => "navigation-test", useRef: () => ({ current: null }) },
  "next/navigation": { usePathname: () => pathname, useSearchParams: () => searchParams },
  "next/link": { default: "a" },
  "motion/react": { LayoutGroup: "div", motion: { nav: "nav", div: "div", span: "span" }, useReducedMotion: () => true },
  "./portal-nav-icons": icons,
  "./portal-tab-icons": { groupIcons: icons, tabIcons: icons },
  "@/lib/portal/access": access,
  "@/components/action-icons": icons,
  "@/lib/portal/letters-return": load("src/lib/portal/letters-return.ts"),
  "@/lib/portal/directory-return": load("src/lib/portal/directory-return.ts"),
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
  assert.deepEqual(links(), ["documents/archive", "charters/constitution", "charters/elections-code"], "Legal subgroup links are visible together");
  assert.ok(render().some(node => node.props?.role === "heading" && node.props?.children?.some?.(child => child?.props?.children === "Charters")), "Subgroups retain accessible headings");
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
  assert.deepEqual(links(), ["documents/archive", "charters/constitution", "charters/elections-code"], "Navigation opens Legals with every permitted subgroup visible");
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
  assert.ok(links().includes("legals/onboarding"), "Onboarding appears in the visible Documents group");
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
  pathname = "/portal/accounts";
  props.tabs = ["dashboard", "accounts", "members"];
  const directoryHref = "/portal/members?view=database&unit=Central+Comelec&q=Juan";
  searchParams = new URLSearchParams({ returnTo: directoryHref });
  let back = render().find(node => node.props?.["aria-label"] === "Back to Directory");
  assert.ok(back, "Accounts opened from Directory show a Directory return control");
  assert.equal(back.props.href, directoryHref, "Return preserves the directory view and filters");
  props.collapsed = true;
  back = render().find(node => node.props?.["aria-label"] === "Back to Directory");
  assert.equal(back.props.title, "Back to Directory", "Collapsed return icon identifies Directory");
  searchParams = new URLSearchParams({ returnTo: "https://example.com" });
  assert.ok(button("Back to all tabs"), "An external URL cannot become a return destination");
  searchParams = new URLSearchParams({ returnTo: directoryHref });
  props.tabs = ["dashboard", "accounts"];
  assert.ok(button("Back to all tabs"), "Return links respect Directory permission");
  searchParams = new URLSearchParams();
  assert.ok(button("Back to all tabs"), "Direct Accounts visits keep normal back navigation");
  console.log("Sidebar panel checks passed: replacement, contextual Directory return, search, permissions, route changes, and collapsed controls.");
} finally {
  if (originalFrame === undefined) delete global.requestAnimationFrame;
  else global.requestAnimationFrame = originalFrame;
}
