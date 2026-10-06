// Run with: node scripts/test-recruitment-position-choices.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Test the form without a Next.js server. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// Keep hook state between renders so we can exercise the form's actual change handlers.
let states = [];
let cursor = 0;
const hooks = {
  ...React,
  useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
    return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
  },
  useActionState: () => [undefined, () => {}, false],
  useTransition: () => [false, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useRef(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = { current: initial };
    return states[index];
  },
  useId: () => `test-${cursor++}`,
};
const emptyComponent = () => null;
const mocks = {
  react: hooks,
  "next/link": emptyComponent,
  "@/lib/applications/actions": { submitApplication: () => {} },
  "@/lib/applications/verification-actions": {},
  "@/lib/applications/receipt-image": {},
  "@/components/portal/portal-form": { useHydrated: () => true, usePortalForm: () => ({ onSubmit: () => {}, errors: {}, pending: false }), FormFooter: emptyComponent },
  "@/components/combobox": { Combobox: emptyComponent },
  "@/components/facebook-profile-input": { FacebookProfileInput: emptyComponent },
  "@/components/interview-picker": { InterviewPicker: emptyComponent },
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    if (name === "./portal-form") return mocks["@/components/portal/portal-form"];
    if (name.startsWith(".")) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}
const { ApplicationForm } = load("src/components/application-form.tsx");
const { positionsForUnit, colleges } = load("src/lib/applications/options.ts");
const [openPosition, closedPosition] = positionsForUnit().map(({ id }) => id);
const college = colleges[0];
const base = { slots: { [openPosition]: 2 }, interviews: [], verified: null, bodies: { central: true, colleges: [college] } };
const render = (props) => {
  cursor = 0;
  return ApplicationForm({ ...props, verified: props.verified ? { email: "applicant@ust.edu.ph", firstName: "Juan", lastName: "Dela Cruz", ...props.verified } : null });
};
function find(tree, predicate) {
  if (!React.isValidElement(tree)) return undefined;
  if (predicate(tree)) return tree;
  for (const child of React.Children.toArray(tree.props.children)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}
const field = (tree, name, value) => find(tree, (item) => item.props.name === name && (value === undefined || item.props.value === value));
const divisionChoice = (tree) => field(tree, "division");
const text = (tree) => renderToStaticMarkup(tree);

let tree = render(base);
assert.equal(divisionChoice(tree), undefined, "Do not offer divisions before a unit is selected");
assert.match(text(tree), /Select where you’d like to serve/);
field(tree, "preferredBody", "central").props.onChange();
tree = render(base);
assert.equal(divisionChoice(tree), undefined, "Positions have no division selection");
tree = render(base);
assert.ok(field(tree, "position", openPosition));
assert.equal(field(tree, "position", closedPosition), undefined, "Full positions are hidden");
assert.equal((text(tree).match(/name="division"/g) ?? []).length, 0, "No division grouping is offered");
assert.match(text(tree), /2 slots open/);
field(tree, "position", openPosition).props.onChange();

// Changing unit clears the position selection.
const centralWithCollege = { ...base, preset: { body: "central", college } };
states = [];
tree = render(centralWithCollege);
tree = render(centralWithCollege);
field(tree, "position", openPosition).props.onChange();
tree = render(centralWithCollege);
field(tree, "preferredBody", "local").props.onChange();
tree = render(centralWithCollege);
assert.equal(divisionChoice(tree), undefined);
assert.equal(field(tree, "position", openPosition).props.checked, false);
tree = render(centralWithCollege);
assert.ok(field(tree, "position", openPosition), "An open Local unit offers positions");
find(tree, (item) => item.props.name === "college").props.onChange(colleges[1]);
tree = render(centralWithCollege);
assert.equal(divisionChoice(tree), undefined, "Changing colleges clears the Local unit selection");
assert.equal(field(tree, "preferredBody", "local").props.checked, false);

for (const overrides of [
  { slots: {} },
  { bodies: { central: false, colleges: [] } },
  { bodies: { central: false, colleges: [colleges[1]] } },
  { verified: { commissionAccounts: { central: true, colleges: [college] } } },
]) {
  states = [3]; // Step 4: positions.
  tree = render({ ...centralWithCollege, ...overrides });
  assert.equal(divisionChoice(tree), undefined);
  assert.equal(field(tree, "position", openPosition), undefined);
  assert.match(text(tree), /We can’t offer you any positions right now/);
  assert.equal(find(tree, (item) => item.props.type === "submit"), undefined, "Hide Continue when no positions can be offered");
  assert.ok(find(tree, (item) => item.props.className === "apply-back"), "Keep Back available");
  states[0] = 2;
  assert.ok(find(render({ ...centralWithCollege, ...overrides }), (item) => item.props.type === "submit"), "Other steps keep their Continue button");
}

states = [3];
assert.ok(find(render(base), (item) => item.props.type === "submit"), "Keep Continue when positions are available");

states = [];
tree = render({ ...centralWithCollege, verified: { commissionAccounts: { central: true, colleges: [] } } });
assert.equal(divisionChoice(tree), undefined, "An ineligible preset must not expose positions");
field(tree, "preferredBody", "local").props.onChange();
assert.ok(field(render({ ...centralWithCollege, verified: { commissionAccounts: { central: true, colleges: [] } } }), "position", openPosition), "Existing Central accounts may still select their open Local unit");
// Each unit offers its own counts, and a Local unit never inherits Central's vacancies.
const localPosition = closedPosition;
const scoped = { ...centralWithCollege, unitSlots: { "": { [openPosition]: 2 }, [college]: { [localPosition]: 1 } } };
states = [];
tree = render(scoped);
tree = render(scoped);
assert.ok(field(tree, "position", openPosition));
assert.equal(field(tree, "position", localPosition), undefined);
field(tree, "preferredBody", "local").props.onChange();
tree = render(scoped);
tree = render(scoped);
assert.ok(field(tree, "position", localPosition), "Local displays its own open position");
assert.equal(field(tree, "position", openPosition), undefined, "Central's position is not offered in Local");
states = [3];
tree = render({ ...scoped, preset: { body: "local", college }, unitSlots: { "": { [openPosition]: 2 } } });
assert.equal(divisionChoice(tree), undefined, "A Local unit with no configured slots has no vacancies");
assert.match(text(tree), /We can’t offer you any positions in this Comelec unit right now/);
assert.equal(find(tree, (item) => item.props.type === "submit"), undefined);
states = [3];
tree = render({ ...scoped, preset: { body: "local", college }, unitSlots: {} });
assert.match(text(tree), /We can’t offer you any positions right now/);

// The assistant to the Central Representative belongs only to the selected Local unit.
const centralAssistant = "ea-central-representative";
const withCentralDivision = { ...centralWithCollege, unitSlots: { "": { [openPosition]: 2, [centralAssistant]: 5 }, [college]: { [centralAssistant]: 1 } } };
states = [3];
tree = render(withCentralDivision);
const centralDivisionChoice = (element) => find(element, (item) => item.props.id === "central" && typeof item.props.onSelect === "function");
assert.equal(centralDivisionChoice(tree), undefined, "Central Comelec does not offer the Local Central Division");
field(tree, "preferredBody", "local").props.onChange();
tree = render(withCentralDivision);
assert.equal(centralDivisionChoice(tree), undefined, "Local positions are offered without division grouping");
tree = render(withCentralDivision);
assert.ok(field(tree, "position", centralAssistant), "Local applicants can choose the assistant to their Central Representative");
field(tree, "preferredBody", "central").props.onChange();
assert.equal(field(render(withCentralDivision), "position", centralAssistant), undefined, "Changing body clears the Local-only position");

// Applicants see all interview times for their chosen unit.
const interviewProps = { ...centralWithCollege, interviews: [
  { id: "central-interview", division: "operations", college: "" },
  { id: "local-interview", division: "legal", college },
  { id: "other-interview", division: "operations", college: colleges[1] },
] };
states = [3];
tree = render(interviewProps);
tree = render(interviewProps);
const picker = (element) => find(element, (item) => Array.isArray(item.props.slots) && Object.hasOwn(item.props, "invalid"));
assert.deepEqual(picker(tree).props.slots.map((slot) => slot.id), ["central-interview"]);
field(tree, "preferredBody", "local").props.onChange();
tree = render(interviewProps);
assert.deepEqual(picker(render(interviewProps)).props.slots.map((slot) => slot.id), ["local-interview"], "Local sees all of its own unit's interviews");

// Rapid clicks must schedule one departure and one arrival, with navigation locked until both finish.
const originalWindow = global.window;
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const timers = new Map();
let timerId = 0;
global.window = { matchMedia: () => ({ matches: false }) };
global.setTimeout = (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; };
global.clearTimeout = (id) => timers.delete(id);
const finishTimer = () => {
  const [id, timer] = timers.entries().next().value;
  timers.delete(id);
  timer.callback();
};
try {
  const props = { ...base, preview: true };
  states = [3];
  tree = render(props);
  const back = find(tree, (item) => item.props.className === "apply-back");
  back.props.onClick();
  back.props.onClick();
  assert.equal(timers.size, 1, "Repeated Back clicks schedule only one transition");
  tree = render(props);
  assert.equal(find(tree, (item) => item.props.type === "submit").props.disabled, true);
  assert.equal(find(tree, (item) => item.props.className === "apply-back").props.disabled, true);
  finishTimer();
  tree = render(props);
  assert.equal(find(tree, (item) => item.type === "h2").props.children, "About you");
  assert.equal(find(tree, (item) => item.props.type === "submit").props.disabled, true, "Lock navigation through the arrival animation");
  tree.props.onSubmit({ preventDefault() {} });
  assert.equal(timers.size, 1, "Continue during arrival cannot restart the transition");
  finishTimer();
  tree = render(props);
  assert.equal(find(tree, (item) => item.props.type === "submit").props.disabled, false);
  tree.props.onSubmit({ preventDefault() {} });
  tree.props.onSubmit({ preventDefault() {} });
  assert.equal(timers.size, 1, "Repeated Continue clicks schedule only one transition");
  finishTimer();
  assert.equal(find(render(props), (item) => item.type === "h2").props.children, "Position");
  finishTimer();
  assert.equal(find(render(props), (item) => item.props.type === "submit").props.disabled, false);

  global.window.matchMedia = () => ({ matches: true });
  find(render(props), (item) => item.props.className === "apply-back").props.onClick();
  assert.equal(timers.size, 0, "Reduced motion switches immediately without animation timers");
  tree = render(props);
  assert.equal(find(tree, (item) => item.type === "h2").props.children, "About you");
  assert.equal(find(tree, (item) => item.props.type === "submit").props.disabled, false);
} finally {
  global.window = originalWindow;
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
}
console.log("Unit selection, open positions, notices, selection resets, and single step transition checks passed.");

// Slot management uses the same flat, unit-specific choices as the application form.
const { RecruitmentForm } = load("src/components/portal/recruitment-form.tsx");
states = []; cursor = 0;
const pharmacyUnit = "Faculty of Pharmacy";
const recruitment = RecruitmentForm({ action: () => {}, slots: { "ea-finance-officer": 3 }, unit: pharmacyUnit });
const markup = text(recruitment);
assert.match(markup, /Executive Assistant to the Finance Head/);
assert.match(markup, /Executive Assistant to the Internal Public Information Officer/);
assert.match(markup, /Executive Assistant to the External Public Information Officer/);
assert.doesNotMatch(markup, /Division|recruitment-division/);
assert.equal(field(recruitment, "slots-ea-finance-officer").props.value, "3");
assert.equal((markup.match(/type="number"/g) ?? []).length, positionsForUnit(pharmacyUnit).length);
const pharmacyPosition = positionsForUnit(pharmacyUnit).find((choice) => choice.role === "Internal Public Information Officer");
const pharmacyProps = { ...base, preset: { body: "local", college: pharmacyUnit }, bodies: { central: true, colleges: [pharmacyUnit] }, unitSlots: { [pharmacyUnit]: { [pharmacyPosition.id]: 1, "ea-public-information-officer": 4 } } };
states = [3]; tree = render(pharmacyProps);
assert.ok(field(tree, "position", pharmacyPosition.id));
assert.equal(field(tree, "position", "ea-public-information-officer"), undefined, "Obsolete offices do not expose vacancies");
assert.equal(field(tree, "division"), undefined);
console.log("Flat recruitment slot controls and Pharmacy-specific application choices passed.");
