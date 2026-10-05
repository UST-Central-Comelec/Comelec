// Run with: node scripts/test-facebook-profile-input.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Test input events without a Next.js runtime. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)((name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), compiled, compiled.exports);
  return compiled.exports;
}
const inputRules = load("src/lib/forms/input.ts");
const facebook = load("src/lib/forms/facebook.ts", { "./input": inputRules });
for (const link of [
  "https://web.facebook.com/janssenjek", "https://facebook.com/janssenjek",
  "https://www.facebook.com/janssenjek", "http://m.facebook.com/janssenjek/",
  "facebook.com/janssenjek", "janssenjek", " https://FACEBOOK.com/janssenjek ",
]) {
  assert.equal(facebook.facebookUsername(link), "janssenjek");
  assert.equal(facebook.facebookProfileUrl(link), "https://facebook.com/janssenjek");
}
assert.equal(facebook.facebookProfileUrl(""), "");
assert.equal(facebook.facebookProfileUrl("facebook.com/"), "");
assert.equal(facebook.facebookUsername("https://facebook.com/profile.php?id=123456"), "profile.php?id=123456", "Keep existing ID-based profiles usable");
assert.equal(facebook.facebookUsername("jan😀ssenjek"), "janssenjek");
assert.equal(facebook.facebookUsername("https://facebook.com.evil.test/user"), "https://facebook.com.evil.test/user", "Only recognize actual Facebook hostnames");

let username;
let changes = 0;
const listeners = new Map();
const form = { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: (name) => listeners.delete(name) };
const { FacebookProfileInput } = load("src/components/facebook-profile-input.tsx", {
  react: {
    useState: (initial) => { username ??= initial(); return [username, (next) => { username = next; }]; },
    useRef: () => ({ current: { form } }),
    useEffect: (effect) => effect(),
  },
  "@/lib/forms/facebook": facebook,
  "./facebook-profile-input.module.css": { field: "facebook-field", prefix: "facebook-prefix", username: "facebook-username" },
});
const props = { onChange: () => changes++ };
const render = (options = props) => FacebookProfileInput(options);
const visible = (tree) => tree.props.children[0].props.children[1];
const hidden = (tree) => tree.props.children[1];
let tree = render();
assert.equal(tree.props.children[0].props.children[0].props.children, "facebook.com/");
assert.equal(hidden(tree).props.value, "", "An empty optional field submits an empty value");
visible(tree).props.onChange({ target: { value: "janssenjek" } });
tree = render();
assert.equal(visible(tree).props.value, "janssenjek");
assert.equal(hidden(tree).props.name, "facebookUrl");
assert.equal(hidden(tree).props.value, "https://facebook.com/janssenjek", "Submit a complete link to existing server validation");

for (const url of ["https://web.facebook.com/janssenjek", "https://facebook.com/janssenjek"]) {
  let prevented = false;
  visible(tree).props.onPaste({
    preventDefault: () => { prevented = true; },
    clipboardData: { getData: () => url },
    currentTarget: { value: "oldusername", selectionStart: 0, selectionEnd: 11 },
  });
  tree = render();
  assert.equal(prevented, true);
  assert.equal(visible(tree).props.value, "janssenjek");
  assert.equal(hidden(tree).props.value, "https://facebook.com/janssenjek");
}
assert.equal(changes, 3, "Typing and pasting notify the form to clear validation errors");
listeners.get("reset")();
assert.equal(visible(render()).props.value, "", "Restarting the application clears the username");
username = undefined;
tree = render({ defaultValue: "https://web.facebook.com/janssenjek", required: true, invalid: true });
assert.equal(visible(tree).props.value, "janssenjek", "Account editing shows only the username from a saved URL");
assert.equal(visible(tree).props.required, true);
assert.equal(visible(tree).props["aria-invalid"], true);
visible(tree).props.onChange({ target: { value: "a".repeat(350) } });
tree = render({ defaultValue: "https://web.facebook.com/janssenjek" });
assert.equal(hidden(tree).props.value.length, 300, "Respect the server's full-link length limit");
listeners.get("reset")();
assert.equal(visible(render({ defaultValue: "https://web.facebook.com/janssenjek" })).props.value, "janssenjek");
console.log("Facebook username entry, full-link pasting, saved profiles, optional values, and form resets passed.");
