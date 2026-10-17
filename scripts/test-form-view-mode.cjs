/* eslint-disable @typescript-eslint/no-require-imports -- Exercise View Mode without a browser session. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", source)(name => {
    if (name in dependencies) return dependencies[name];
    if (name.endsWith(".css")) return {};
    if (name.startsWith("@/")) {
      const target = path.resolve("src", name.slice(2));
      return load(fs.existsSync(target + ".ts") ? target + ".ts" : target + ".tsx", dependencies);
    }
    throw Error("Unexpected dependency: " + name);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const store = new Map();
const storage = {
  get length() { return store.size; },
  key: index => [...store.keys()][index] ?? null,
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: key => store.delete(key),
};
const forms = load("src/lib/forms/view-mode.ts");
const definition = { steps: [{ id: "step", title: "Draft step", fields: [] }] };
const rsvp = { kind: "rsvp", name: "Draft event", eventId: "sample", definition };
const url = forms.storeFormView(storage, rsvp, "tab-one");
assert.equal(url, "/forms/preview?draft=tab-one");
const raw = storage.getItem(forms.formViewKey("tab-one"));
assert.deepEqual(forms.readFormView(raw), rsvp, "The current unsaved definition reaches View Mode");
definition.steps[0].title = "Edited after opening";
assert.equal(forms.readFormView(raw).definition.steps[0].title, "Draft step", "Open views keep an independent snapshot");
forms.storeFormView(storage, rsvp, "tab-two");
assert.equal(forms.readFormView(storage.getItem(forms.formViewKey("tab-one"))).definition.steps[0].title, "Draft step", "Multiple tabs never overwrite each other");
assert.equal(forms.readFormView(raw, Date.now() + 31 * 60 * 1000), null, "Expired views are refused");
assert.equal(forms.readFormView("not json"), null);
assert.equal(forms.readFormView(null), null);
storage.setItem(forms.formViewKey("broken"), "broken");
forms.storeFormView(storage, rsvp, "later", Date.now() + 31 * 60 * 1000);
assert.equal(storage.getItem(forms.formViewKey("tab-one")), null, "Old drafts are cleaned up");
assert.equal(storage.getItem(forms.formViewKey("broken")), null, "Malformed drafts are cleaned up");

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const EventRegistration = () => null, RsvpForm = () => null, EvaluationForm = () => null, SurveyAnswer = () => null;
global.localStorage = storage;
const view = load("src/components/form-view-mode.tsx", {
  "react": { useMemo: fn => fn(), useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
  "react/jsx-runtime": jsx,
  "@/components/events/registration-form": { EventRegistration },
  "@/lib/events/schema": { emptyRegistration: () => ({ requests: [] }) },
  "@/lib/events/options": { allowedAffiliations: () => ["ust-student", "external"] },
  "@/components/events/rsvp-form": { RsvpForm },
  "@/components/events/evaluation-form": { EvaluationForm },
  "@/components/portal/survey-answer": { SurveyAnswer },
});
function walk(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(walk);
  return [node, ...walk(node.props?.children)];
}
for (const [draft, component] of [
  [{ kind: "registration", name: "Closed registration", eventId: "sample" }, EventRegistration],
  [rsvp, RsvpForm],
  [{ kind: "evaluation", name: "Closed evaluation", eventId: "sample", settings: { enabled: false, questions: [] } }, EvaluationForm],
  [{ kind: "survey", name: "Draft survey", description: "Description", definition }, SurveyAnswer],
]) {
  forms.storeFormView(storage, draft, "render");
  const nodes = walk(view.FormViewMode({ token: "render" }));
  const form = nodes.find(node => node.type === component);
  assert.ok(form, "View Mode uses the real respondent form");
  assert.equal(form.props.preview, true, "Every respondent form bypasses submission");
  if (component === EventRegistration) assert.equal(form.props.mode, "register", "Registration can be viewed even when sign-ups are closed");
  if (component === EvaluationForm) assert.equal(form.props.settings.enabled, true, "Closed evaluations can still be viewed");
}
assert.equal(walk(view.FormViewMode({ token: "missing" })).some(node => [EventRegistration, RsvpForm, EvaluationForm, SurveyAnswer].includes(node.type)), false, "Missing views do not mount a live form");
const messages = [];
const button = load("src/components/portal/form-view-mode-button.tsx", {
  "react/jsx-runtime": jsx,
  "@/components/action-icons": { ViewIcon: () => null },
  "./toast": { toast: (...args) => messages.push(args) },
}).FormViewModeButton({ draft: rsvp });
assert.equal(button.type, "a");
assert.equal(button.props.target, "_blank", "View Mode opens in its own tab");
const event = { currentTarget: {}, prevented: false, preventDefault() { this.prevented = true; } };
button.props.onClick(event);
assert.match(event.currentTarget.href, /^\/forms\/preview\?draft=/);
storage.setItem = () => { throw Error("Storage unavailable"); };
button.props.onClick(event);
assert.equal(event.prevented, true, "Storage failures keep the user in the editor");
assert.equal(messages.at(-1)[1], "error", "Storage failures use the shared toast");

// Registration View Mode visits every step without validating or sending an action.
const stateSlots = [];
let stateIndex = 0, guardedAction;
const registration = load("src/components/events/registration-form.tsx", {
  "react/jsx-runtime": jsx,
  "react": {
    useState: initial => {
      const index = stateIndex++;
      if (!(index in stateSlots)) stateSlots[index] = typeof initial === "function" ? initial() : initial;
      return [stateSlots[index], value => { stateSlots[index] = typeof value === "function" ? value(stateSlots[index]) : value; }];
    },
    useActionState: action => { guardedAction = action; return [undefined, () => { throw Error("Must not submit"); }, false]; },
    useRef: () => ({ current: null }), useEffect: () => {}, useId: () => "registration",
    startTransition: () => { throw Error("Must not start a submission"); },
  },
  "next/link": { default: () => null },
  "lucide-react": {},
  "@/lib/scroll": {},
  "@/components/combobox": {},
  "@/components/portal/portal-form": { useHydrated: () => true },
  "@/lib/applications/options": { programsByCollege: {}, yearLevelsFor: () => ({}), colleges: {}, comelecUnits: {}, programLocked: () => false },
  "@/lib/events/options": { affiliationChoices: {}, attendingChoices: {}, requestKinds: {}, sexChoices: {}, isUstAffiliation: () => false },
  "@/lib/events/schema": { needsVerification: () => false, checkRegistration: () => { throw Error("Preview must skip validation"); }, stepOf: {} },
  "./event-form-ui": { EventFormTracker: () => null, EventConsentStatement: () => null },
  "@/components/action-icons": { CopyIcon: () => null },
  "./rsvp.css": {},
  "@/components/use-form-draft": { useFormDraft: () => ({ restoredAt: null, endsAt: null, expired: false, clear: () => {}, startOver: () => {} }), forgetFormDraft: () => {} },
  "@/components/draft-notice": { DraftNotice: () => null },
});
const registrationNode = registration.EventRegistration({ preview: true, action: () => { throw Error("Live action must not run"); }, event: { id: "sample", name: "Sample" }, mode: "register", form: { initial: { requests: [] }, verifiedEmail: null, requireGoogle: true, allowed: [], fromWaitlist: false } });
function renderRegistration() { stateIndex = 0; return registrationNode.type(registrationNode.props); }
for (let step = 0; step < 5; step++) {
  const form = renderRegistration();
  assert.equal(form.props["data-validation"], "off");
  const stepButtons = walk(form).filter(node => node.type === "button" && node.props.type === "button" && node.props.disabled !== undefined);
  assert.ok(stepButtons.every(node => !node.props.disabled), "Every step can be visited in View Mode");
  form.props.onSubmit({ preventDefault() {} });
}
assert.ok(walk(renderRegistration()).some(node => node.type?.name === "Saved" && typeof node.props.onBack === "function"), "Preview ends at an acknowledgement without sending");
const previewAction = guardedAction;
(async () => {
  assert.equal(await previewAction(undefined, new FormData()), undefined, "Registration preview cannot call the live action");
  let authenticated = false;
  const page = load("src/app/(view-mode)/forms/preview/page.tsx", {
    "react/jsx-runtime": jsx,
    "@/lib/auth/session": { withPortalUser: async () => { authenticated = true; } },
    "@/components/form-view-mode": { FormViewMode: view.FormViewMode },
  });
  const result = await page.default({ searchParams: Promise.resolve({ draft: "render" }) });
  assert.equal(authenticated, true, "Standalone views require a signed-in portal user");
  assert.equal(result.props.token, "render");
  const denied = load("src/app/(view-mode)/forms/preview/page.tsx", {
    "react/jsx-runtime": jsx,
    "@/lib/auth/session": { withPortalUser: async () => { throw Error("Sign in"); } },
    "@/components/form-view-mode": { FormViewMode: view.FormViewMode },
  });
  await assert.rejects(denied.default({ searchParams: Promise.resolve({ draft: "render" }) }), /Sign in/);
  delete global.localStorage;
  console.log("View Mode passed: draft snapshots, separate tabs, expiry, auth, public forms, closed evaluations, submission bypass, and failure feedback.");
})().catch(error => { console.error(error); process.exitCode = 1; });
