/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const CodeEditor = () => null;
const CodeReader = () => null;
const placeholder = () => null;
const published = { articles: [], version: 0, publishedAt: null };
let user = { readOnly: false, legalEditor: true };
let draft = null;
let draftError = false;
const draftText = [{ id: "article-draft", numeral: "I", title: "Draft heading", sections: [] }];
const codes = Object.fromEntries(["magna-carta", "constitution", "elections-code"].map(code => [code, { tab: `charters/${code}`, title: code, the: `the ${code}`, path: `/${code}` }]));
const dependencies = {
  "@/components/action-icons": new Proxy({}, { get: () => placeholder }),
  "next/navigation": { notFound: () => { throw new Error("Not found"); } },
  "next/link": { default: placeholder },
  "lucide-react": Object.fromEntries(["ArrowUpRight", "BookOpenText", "History", "ListChecks", "PencilLine", "Settings2"].map(name => [name, placeholder])),
  "@/components/portal/code-editor": { CodeEditor },
  "@/components/portal/code-reader": { CodeReader },
  "@/components/portal/code-settings-form": { CodeSettingsForm: placeholder },
  "@/components/portal/code-revision": { Signers: placeholder, formatWhen: value => value },
  "@/components/portal/info-tip": { InfoTip: placeholder, TitleWithInfo: placeholder },
  "@/components/portal/sliding-subtabs": { SlidingSubtabs: placeholder },
  "@/components/portal/notice": { Notice: placeholder },
  "@/components/portal/view-only": { ViewOnlyTag: placeholder },
  "@/lib/applications/period": { formatClosing: value => value },
  "@/lib/auth/session": { allowed: () => async () => user, withPortalUser: async (load, check) => [await check(), await load] },
  "@/lib/codes/diff": { describeStats: () => "No changes" },
  "@/lib/codes/options": { codes, isCodeKey: value => Object.hasOwn(codes, value), canEditCodes: value => value.legalEditor, approverRoles: ["Chairperson", "Vice Chairperson", "Secretary to the Executive"], editorRoles: ["Legal Head", "Secretary to the Adjudicatory"], describeRevision: () => ({}), signedCount: () => 0, versionName: value => `Version ${value}` },
  "@/lib/codes/store": { getPublishedCode: async () => published, listRevisions: async () => draft ? [draft] : [], getOpenRevision: async () => { if (draftError) throw new Error("Database unavailable"); return draft; }, isCodesMissing: () => false },
  "@/lib/codes/settings": { getCodeSettings: async () => ({ visibility: "hidden" }) },
  "@/lib/codes/text": { countSections: () => 0, tidyArticles: value => value },
  "@/lib/portal/access": { tabHref: tab => `/portal/${tab}` },
  "@/lib/portal/settle": { settle: async promise => { try { return { value: await promise }; } catch (error) { return { error: error.message }; } } },
  "@/lib/portal/code-actions": { saveCodeRevision: async (code) => ({ code }), discardCodeRevision: async () => {} },
};
const compiled = { exports: {} };
const source = ts.transpileModule(fs.readFileSync("src/app/(portal)/portal/(dashboard)/charters/[code]/page.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
new Function("require", "exports", source)(name => dependencies[name] ?? require(name), compiled.exports);
const page = (code = "magna-carta", show) => compiled.exports.default({ params: Promise.resolve({ code }), searchParams: Promise.resolve({ show }) });
function find(node, type) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const child of node) { const match = find(child, type); if (match) return match; } return null; }
  return node.type === type ? node : find(node.props?.children, type);
}
(async () => {
  let editor = find(await page(), CodeEditor);
  assert.ok(editor, "The Text tab opens the inline editor for authorized legal editors");
  assert.deepEqual(editor.props.initial, [], "New Magna Carta starts empty");
  assert.equal((await editor.props.save(undefined, new FormData())).code, "magna-carta");
  draft = { id: "draft-1", status: "draft", articles: draftText, baseArticles: [], edits: 3, updatedAt: "2026-10-08T00:00:00Z", summary: "New draft", author: { name: "Legal Editor", role: "Legal Head" }, stats: {} };
  editor = find(await page(), CodeEditor);
  assert.deepEqual(editor.props.initial, draftText, "Reopening the tab resumes saved draft contents");
  assert.equal(editor.props.draft.edits, 3, "Saving uses the draft's concurrency counter");
  draft.status = "pending";
  assert.equal(find(await page(), CodeEditor), null, "Pending revisions stay locked");
  draft.status = "draft";
  user.readOnly = true;
  assert.equal(find(await page(), CodeEditor), null, "Read-only accounts cannot edit");
  user = { readOnly: false, legalEditor: false };
  assert.equal(find(await page(), CodeEditor), null, "Other roles retain the reader");
  user.legalEditor = true;
  draftError = true;
  assert.equal(find(await page(), CodeEditor), null, "A failed draft read cannot start an accidental replacement");
  draftError = false;
  assert.equal(find(await page("constitution"), CodeEditor), null, "Other documents retain their existing Text tab");
  assert.equal(find(await page("magna-carta", "settings"), CodeEditor), null);
  console.log("Magna Carta inline editor checks passed: blank contents, saved drafts, pending lock, role permissions, and failed reads.");
})();
