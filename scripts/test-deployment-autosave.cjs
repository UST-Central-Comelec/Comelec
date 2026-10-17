/* eslint-disable @typescript-eslint/no-require-imports -- Exercise persistence and display timers without a browser. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const source = ts.transpileModule(fs.readFileSync("src/components/portal/use-deployment-schedule.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const live = { published: true, registrationStatus: "closed", minimumRegistrants: "1", maximumRegistrants: "",
  requireGoogle: true, rsvpEnabled: false, rsvpGoogle: false, evaluationEnabled: false, evaluationGoogle: false, allowAnonymous: false };
const schedule = (values, version = "version-1") => ({ values, version, applyAt: "1970-01-01T00:01:00.000Z", error: null });
function fixture({ initial = null, editable = true, start = 0 } = {}) {
  let now = start, cursor = 0, nextTimer = 0, refreshes = 0, result;
  const slots = [], effects = [], pendingEffects = [], timers = new Map(), requests = [], messages = [];
  const router = { refresh() { refreshes++; } };
  const react = {
    useState(initialValue) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initialValue === "function" ? initialValue() : initialValue;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useCallback: callback => callback,
    useEffect(effect, dependencies) {
      const index = cursor++, previous = effects[index];
      if (previous && previous.dependencies.every((value, i) => Object.is(value, dependencies[i]))) return;
      pendingEffects.push(() => { previous?.cleanup?.(); effects[index] = { dependencies, cleanup: effect() }; });
    },
  };
  const compiled = { exports: {} };
  vm.runInNewContext(source, {
    exports: compiled.exports,
    require: name => name === "react" ? react : name === "next/navigation" ? { useRouter: () => router } : name === "./toast" ? { toast: (...args) => messages.push(args) } : {},
    Date: class extends Date { static now() { return now; } },
    crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })),
    setInterval: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay, due: now + delay }); return id; },
    clearInterval: id => timers.delete(id),
  });
  const render = () => {
    cursor = 0;
    result = compiled.exports.useDeploymentSchedule("sample", live, initial, editable);
    while (pendingEffects.length) pendingEffects.shift()();
    return result;
  };
  render();
  return {
    requests, messages, render,
    change(value) { result.change("registrationStatus", value); render(); },
    async respond(index, body, ok = true) {
      requests[index].resolve({ ok, json: async () => body });
      await new Promise(setImmediate);
      render();
    },
    discard() { void result.discard(); render(); },
    retry() { result.retry(); render(); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers.values()].filter(timer => timer.due <= end).sort((a,b) => a.due-b.due)[0];
        if (!next) break;
        now = next.due; next.due += next.delay; next.callback();
      }
      now = end; render();
    },
    cleanup() { effects.forEach(effect => effect?.cleanup?.()); },
    get refreshes() { return refreshes; },
  };
}
(async () => {
  const editor = fixture();
  editor.advance(120000);
  assert.equal(editor.requests.length, 0, "Opening Deployment never reschedules unchanged settings");
  editor.change("open");
  assert.equal(editor.requests.length, 1, "Edits persist immediately, before the minute elapses");
  const request = editor.requests[0];
  assert.equal(request.options.keepalive, true, "Requests continue when the tab closes");
  assert.equal(request.options.signal, undefined, "Unmount never aborts a scheduling request");
  assert.equal(JSON.parse(request.options.body).values.registrationStatus, "open");
  editor.change("waitlist");
  assert.equal(JSON.parse(editor.requests[1].options.body).revision, 2, "Each edit has a monotonic revision");
  await editor.respond(1, { success: true, scheduled: schedule({ ...live, registrationStatus: "waitlist" }, "latest") });
  await editor.respond(0, { success: true, scheduled: schedule({ ...live, registrationStatus: "open" }, "old") });
  assert.equal(editor.render().draft.registrationStatus, "waitlist", "Late replies never replace the newest edit");
  assert.equal(editor.render().scheduled.version, "latest");
  const before = editor.requests.length;
  editor.advance(60000);
  assert.equal(editor.requests.length, before, "The countdown only displays status; it never performs the save");
  assert.ok(editor.refreshes > 0, "The open page refreshes after the server deadline");
  editor.cleanup();

  const leaving = fixture();
  leaving.change("open");
  leaving.cleanup();
  await leaving.respond(0, { success: true, scheduled: schedule({ ...live, registrationStatus: "open" }) });
  assert.equal(leaving.requests[0].options.keepalive, true, "A pending edit remains deliverable after navigation");

  const returning = fixture({ initial: schedule({ ...live, registrationStatus: "open" }), start: 20000 });
  assert.equal(returning.render().draft.registrationStatus, "open", "Returning loads the persisted pending settings");
  assert.equal(returning.render().remaining, 40, "Returning resumes the original database deadline");
  assert.equal(returning.requests.length, 0, "Returning never restarts the grace period");
  returning.discard();
  assert.equal(JSON.parse(returning.requests[0].options.body).cancelVersion, "version-1", "Discard targets the exact scheduled version");
  await returning.respond(0, { success: true });
  assert.equal(returning.render().scheduled, null);
  assert.equal(returning.render().draft.registrationStatus, "closed");
  assert.equal(returning.messages.length, 1, "Discard confirmation uses the shared toast");
  returning.cleanup();

  const failed = fixture();
  failed.change("open");
  await failed.respond(0, { error: "Connection failed." }, false);
  assert.equal(failed.render().state.error, "Connection failed.");
  assert.equal(failed.render().draft.registrationStatus, "open", "Failed requests retain edits for retry");
  failed.retry();
  assert.equal(failed.requests.length, 2);
  failed.cleanup();

  const reader = fixture({ editable: false });
  reader.change("open");
  assert.equal(reader.requests.length, 0, "Readers cannot schedule changes");
  reader.cleanup();
  console.log("Deployment scheduling passed: immediate keepalive persistence, request ordering, background delivery, resumed deadlines, cancellation, failure recovery, and read-only access.");
})().catch(error => { console.error(error); process.exitCode = 1; });
