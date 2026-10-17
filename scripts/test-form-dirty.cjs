/* eslint-disable @typescript-eslint/no-require-imports -- Exercise change tracking without a browser session. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const compiled = { exports: {} };
let cleanup, observeChanges, dirty = false;
const fields = [
  { name: "name", type: "text", value: "Sample event" },
  { name: "venueType", type: "hidden", value: "in-campus" },
  { name: "background", type: "hidden", value: "Original background" },
  { name: "openToStudents", type: "checkbox", value: "on", checked: true },
  { name: "minimumRegistrants", type: "number", value: "1", disabled: false },
];
const root = new EventTarget();
root.querySelectorAll = () => fields;
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/components/use-form-dirty.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: compiled.exports,
  require: () => ({
    useState: () => [dirty, value => { dirty = value; }],
    useEffect: effect => { cleanup = effect(); },
  }),
  MutationObserver: class {
    constructor(callback) { observeChanges = callback; }
    observe() {}
    disconnect() { observeChanges = null; }
  },
});
const { useFormDirty, formValueStamp } = compiled.exports;
useFormDirty({ current: root });
assert.equal(dirty, false, "A loaded form starts unchanged");
fields[0].value = "Edited event";
root.dispatchEvent(new Event("input"));
assert.equal(dirty, true, "Typing marks the form as changed");
fields[0].value = "Sample event";
root.dispatchEvent(new Event("input"));
assert.equal(dirty, false, "Reverting text restores the unchanged state");
fields[1].value = "online";
observeChanges();
assert.equal(dirty, true, "Controlled picker values count as changes");
fields[1].value = "in-campus";
observeChanges();
assert.equal(dirty, false, "Reverting a picker restores the unchanged state");
fields[2].value = "Edited background";
observeChanges();
assert.equal(dirty, true, "Rich text stored in a hidden input counts");
fields[2].value = "Original background";
fields[3].checked = false;
root.dispatchEvent(new Event("change"));
assert.equal(dirty, true, "Checkbox changes count");
fields[3].checked = true;
root.dispatchEvent(new Event("change"));
assert.equal(dirty, false, "Reverting a checkbox restores the unchanged state");
fields[4].disabled = true;
observeChanges();
assert.equal(dirty, false, "Disabling fields while saving does not count as an edit");
fields.push({ name: "collaborators", type: "hidden", value: "New collaborator" });
observeChanges();
assert.equal(dirty, true, "Dynamically added fields count");
fields.pop();
observeChanges();
assert.equal(dirty, false, "Removing an added field restores the unchanged state");
assert.equal(formValueStamp({ steps: [{ id: "a", title: "Step" }] }), formValueStamp({ steps: [{ title: "Step", id: "a" }] }), "Object key order does not count as an edit");
assert.notEqual(formValueStamp({ steps: ["a", "b"] }), formValueStamp({ steps: ["b", "a"] }), "Reordering steps counts as an edit");
cleanup();
fields[0].value = "After unmount";
root.dispatchEvent(new Event("input"));
assert.equal(dirty, false, "Unmount removes field listeners");
assert.equal(observeChanges, null, "Unmount disconnects the observer");
console.log("Form change tracking passed: edits, reverts, pickers, rich text, choices, dynamic fields, order, and cleanup.");

const ui = { exports: {} };
const Link = () => null;
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/components/portal/portal-form.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, {
  exports: ui.exports,
  require: name => name === "react/jsx-runtime" ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
    : name === "react" ? { useSyncExternalStore: () => true }
    : name === "next/link" ? { default: Link }
    : {},
});
const base = { pending: false, submitLabel: "Save changes", cancelHref: "/portal/events/sample", formId: "event" };
const render = props => ui.exports.FormActions({ ...base, ...props }).props.children.filter(Boolean);
const unchanged = render({ cancelVisible: false, saveDisabled: true });
assert.equal(unchanged.some(node => node.type === Link), false, "Cancel is absent on an unchanged form");
assert.equal(unchanged.find(node => node.type === "button").props.disabled, true, "Save is locked on an unchanged form");
const edited = render({ cancelVisible: true, saveDisabled: false });
assert.equal(edited.some(node => node.type === Link), true, "Cancel is available after an edit");
assert.equal(edited.find(node => node.type === "button").props.disabled, false, "Save is available after an edit");
assert.equal(render({ pending: true }).find(node => node.type === "button").props.disabled, true, "Save stays locked while a request is pending");
const footer = ui.exports.FormFooter({ ...base, cancelVisible: false, saveDisabled: true }).props.children.find(node => node?.type === ui.exports.FormActions);
assert.equal(footer.props.cancelVisible, false, "The Details footer passes through Cancel visibility");
assert.equal(footer.props.saveDisabled, true, "The Details footer passes through the save lock");
console.log("Footer actions passed: unchanged, edited, pending, and shared footer behavior.");
