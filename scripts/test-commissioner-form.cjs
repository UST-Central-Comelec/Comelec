// Run with: node scripts/test-commissioner-form.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise form change handlers without a Next.js server. */
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
let states = [], cursor = 0;
const hooks = { ...React, useId: () => `field-${cursor++}`, useState(initial) {
  const index = cursor++;
  if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
  return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
} };
const noop = () => null;
const mocks = {
  react: hooks, "next/image": noop,
  "@/components/combobox": { Combobox: noop },
  "@/components/facebook-profile-input": { FacebookProfileInput: noop },
  "./dropdown": { Dropdown: noop }, "./info-tip": { InfoTip: noop }, "./photo-input": { PhotoInput: noop },
  "./portal-form": { Field: noop, FormFooter: noop, uppercaseInput: noop, usePortalForm: () => ({ errors: {}, onSubmit: noop, pending: false }) },
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? path.resolve("src", name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`);
    }
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}
function find(tree, predicate) {
  if (!React.isValidElement(tree)) return;
  if (predicate(tree)) return tree;
  for (const child of React.Children.toArray(tree.props.children)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
const { AccountForm } = load("src/components/portal/account-forms.tsx");
const manager = { kind: "personal", affiliation: "central", position: "executive-board", college: null };
const render = (askEmail = true) => { cursor = 0; return AccountForm({ manager, action: noop, askEmail, submitLabel: "Add", cancelHref: "/portal/accounts" }); };
const field = (tree, name) => find(tree, node => node.props.name === name);
const position = tree => find(tree, node => node.props.placeholder === "Select position");
let tree = render();
assert.equal(field(tree, "middleName").props.required, true);
const emailPattern = new RegExp(`^(?:${field(tree, "email").props.pattern})$`);
assert.equal(emailPattern.test("juan@ust.edu.ph"), true);
assert.equal(emailPattern.test("juan@gmail.com"), false);
assert.equal(emailPattern.test("juan@ust.edu.ph.evil.example"), false);
const student = { value: "00A12-3456789" };
field(tree, "studentNumber").props.onInput({ currentTarget: student });
assert.equal(student.value, "0012345678");
assert.deepEqual(position(tree).props.options.map(option => option.value), ["executive-board", "executive-associate", "adviser"]);
const commission = find(tree, node => node.type === "fieldset" && React.Children.toArray(node.props.children)[0]?.props.children === "In the commission");
const grid = React.Children.toArray(commission.props.children)[1];
assert.ok(field(grid.props.children[0], "affiliation"));
assert.ok(field(grid.props.children[1], "college"));
assert.ok(field(grid.props.children[2], "position"));
assert.equal(grid.props.children[3].props.label, "Role");
assert.equal(grid.props.children[3].props.wide, undefined);
assert.equal(field(tree, "notifyEmail").props.defaultChecked, true);
field(tree, "affiliation").props.onChange("local");
tree = render();
assert.deepEqual(position(tree).props.options.map(option => option.value), ["executive-board", "executive-associate", "deputy", "adviser"]);
position(tree).props.onChange("executive-board");
tree = render();
assert.ok(field(tree, "role").props.options.includes("Central Representative"));
field(tree, "role").props.onChange("Central Representative");
tree = render();
assert.equal(field(tree, "position").props.value, "executive-board");
assert.equal(field(tree, "role").props.role, "Central Representative");
field(tree, "college").props.onChange("Junior High School");
tree = render();
assert.equal(field(tree, "program"), undefined);
assert.deepEqual(field(tree, "yearLevel").props.options.map(option => option.label), ["Grade 7", "Grade 8", "Grade 9", "Grade 10"]);
field(tree, "yearLevel").props.onChange("7");
field(tree, "college").props.onChange("Senior High School");
tree = render();
assert.equal(field(tree, "program").props.options.length, 12);
assert.deepEqual(field(tree, "yearLevel").props.options.map(option => option.label), ["Grade 11", "Grade 12"]);
assert.equal(field(tree, "yearLevel").props.value, "");
field(tree, "college").props.onChange("Education High School");
tree = render();
assert.equal(field(tree, "program"), undefined);
field(tree, "affiliation").props.onChange("osa");
tree = render();
assert.deepEqual(position(tree).props.options.map(option => option.value), ["admin"]);
assert.equal(field(tree, "position").props.value, "admin");
assert.equal(field(render(false), "notifyEmail"), undefined);
console.log("Commissioner form validation, field placement, notification checkbox, school options and selection resets passed.");
