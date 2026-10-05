// Run with: node scripts/test-profile-menu.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Render the profile menu without Next.js. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, dependencies) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), compiled, compiled.exports);
  return compiled.exports;
}
const types = load("src/lib/data/types.ts", {});
const { ComelecLoadingScreen } = load("src/components/comelec-loading-screen.tsx", {
  "next/image": props => React.createElement("img", { ...props, priority: undefined }),
  "./comelec-loading-screen.css": {},
});
let pending = false;
let error;
const { ProfileMenu } = load("src/components/portal/profile-menu.tsx", {
  react: { ...React, useActionState: () => [error, () => {}, pending] },
  "react-dom": { createPortal: (children, container) => { assert.equal(container, global.document.body); return children; } },
  "./account-switch-transition": { useAccountSwitchTransition: () => ({ begin: () => {}, cancel: () => {} }) },
  "next/link": ({ children, ...props }) => React.createElement("a", props, children),
  "@/lib/portal/auth-actions": { logout: () => {}, switchPortalAccount: () => {} },
  "@/lib/data/types": types,
  "@/lib/applications/options": load("src/lib/applications/options.ts", {}),
  "./portal-theme": { ThemeToggle: () => React.createElement("button", { type: "button", "aria-label": "Change theme" }, "Theme") },
});
const user = { id: "local", name: "Juan Dela Cruz", role: "Deputy (Local)", email: "juan@ust.edu.ph", avatarUrl: null };
const local = { id: "local", affiliation: "local", college: "Faculty of Pharmacy", role: "Deputy" };
const central = { id: "central", affiliation: "central", college: "Faculty of Pharmacy", role: "Office of the Chairperson" };
const render = memberships => renderToStaticMarkup(React.createElement(ProfileMenu, { user, memberships }));
for (const memberships of [[local], [central, local]]) {
  const html = render(memberships);
  assert.match(html, /popover="auto"/);
  assert.match(html, /popoverTarget=/i);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /My account settings/);
  assert.match(html, /juan@ust.edu.ph/);
  assert.match(html, /Change theme/);
  assert.match(html, /Website/);
  assert.match(html, /Log out/);
  assert.match(html, /lucide-door-open/);
}
assert.doesNotMatch(render([local]), /Switch account/);
const dual = render([central, local]);
assert.match(dual, /Switch account/);
assert.match(dual, /Central Comelec/);
assert.match(dual, /PHARMA Comelec/);
assert.match(dual, /name="accountId" value="central"/);
assert.match(dual, /name="accountId" value="local"/);
assert.match(dual, /is-current[^>]*disabled=""[^>]*aria-current="true"/);
const previousDocument = global.document;
try {
  global.document = { body: {} };
  pending = true;
  const switching = renderToStaticMarkup(React.createElement(ComelecLoadingScreen, { label: "Switching Comelec account", message: "Switching Account", progress: true }));
  assert.match(switching, /class="site-loader"/);
  assert.match(switching, /Switching Comelec account/);
  assert.match(switching, /CENTRAL COMELEC/);
  const complete = renderToStaticMarkup(React.createElement(ComelecLoadingScreen, { progress: true, complete: true }));
  assert.match(complete, /site-loader-progress is-complete/);
  assert.match(complete, /aria-valuenow="100"/);
  pending = false;
  assert.doesNotMatch(render([central, local]), /class="site-loader"/);
  error = { error: "Account no longer available" };
  assert.doesNotMatch(render([central, local]), /class="site-loader"/);
  assert.match(render([central, local]), /Account no longer available/);
} finally {
  if (previousDocument === undefined) delete global.document;
  else global.document = previousDocument;
}
console.log("Profile menu renders settings, theme, home and logout for every account, plus Central/Local switching only for multiple memberships.");
