// Run with: node scripts/test-account-switch-transition.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the transition lifecycle without a browser. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const ts = require("typescript");
const React = require("react");
let switching = null;
let changed = false;
let effect;
const dependencies = {
  react: { ...React,
    useState: () => [switching, value => { switching = typeof value === "function" ? value(switching) : value; changed = true; }],
    useCallback: callback => callback,
    useEffect: callback => { effect = callback; },
  },
  "react-dom": { createPortal: children => children },
  "@/components/comelec-loading-screen": { ComelecLoadingScreen: () => null },
};
const compiled = { exports: {} };
const source = ts.transpileModule(readFileSync("src/components/portal/account-switch-transition.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
new Function("require", "module", "exports", source)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), compiled, compiled.exports);
const { AccountSwitchTransition } = compiled.exports;
const savedDocument = global.document;
const savedWindow = global.window;
let timer;
try {
  global.document = { body: {} };
  global.window = { setTimeout: (callback, delay) => { timer = { callback, delay }; return 1; }, clearTimeout: () => { timer = null; } };
  const render = accountId => {
    let tree;
    do { changed = false; tree = AccountSwitchTransition({ accountId, children: null }); } while (changed);
    return tree;
  };
  const screen = tree => React.Children.toArray(tree.props.children).find(child => React.isValidElement(child) && child.props.message === "Switching Account");
  let tree = render("central");
  assert.equal(screen(tree), undefined);
  tree.props.value.begin("local");
  tree = render("central");
  assert.equal(screen(tree).props.complete, false);
  effect();
  assert.equal(timer, undefined, "Do not dismiss while the old account is still active");
  tree = render("local");
  assert.equal(screen(tree).props.complete, true, "The new account triggers the final progress segment");
  tree.props.value.cancel();
  assert.equal(switching.complete, true, "Settling the old form must not cut off completion");
  effect();
  assert.equal(timer.delay, 350);
  assert.ok(screen(render("local")), "Keep the completed bar visible during the hold");
  timer.callback();
  tree = render("local");
  assert.equal(screen(tree), undefined);
  tree.props.value.begin("central");
  tree = render("local");
  tree.props.value.cancel();
  assert.equal(screen(render("local")), undefined, "A failed switch clears the screen");
} finally {
  if (savedDocument === undefined) delete global.document; else global.document = savedDocument;
  if (savedWindow === undefined) delete global.window; else global.window = savedWindow;
}
console.log("Account switching stays visible through navigation, reaches completion, holds the full bar, and clears on failure.");
