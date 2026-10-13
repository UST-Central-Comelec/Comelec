/* eslint-disable @typescript-eslint/no-require-imports -- Run hook behavior checks without Next.js. */
// Exercise cadence and lifecycle without requiring a logged-in portal session.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/components/use-icon-cycle.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function fixture({ reduced = false, active = false } = {}) {
  let cleanup, observer, now = 0, id = 0;
  const timers = new Map(), starts = [], poses = [];
  const control = new EventTarget();
  Object.assign(control, { hovered: false, selected: false, disabled: false,
    matches(selector) { return selector.startsWith(':disabled') ? this.disabled : selector.startsWith(':hover') ? this.hovered : this.selected; },
    closest() { return null; }, querySelector() { return null; } });
  const media = Object.assign(new EventTarget(), { matches: reduced });
  const document = Object.assign(new EventTarget(), { hidden: false });
  const schedule = (fn, delay, repeat = false) => { const key = ++id; timers.set(key, { fn, delay, due: now + delay, repeat }); return key; };
  const compiled = { exports: {} };
  vm.runInNewContext(code, { exports: compiled.exports, document, window: { matchMedia: () => media },
    require: name => name === 'react' ? { useEffect: fn => { cleanup = fn(); } } : { useReducedMotion: () => reduced },
    MutationObserver: class { constructor(fn) { observer = fn; } observe() {} disconnect() { observer = null; } },
    setInterval: (fn, delay) => schedule(fn, delay, true), setTimeout: schedule,
    clearInterval: key => timers.delete(key), clearTimeout: key => timers.delete(key),
  });
  compiled.exports.useIconCycle({ current: { closest: () => control } }, {
    start: pose => { if (pose === 'animate') starts.push(now); }, stop() {}, set: pose => poses.push(pose),
  }, { active });
  return { control, document, media, starts, poses, timers,
    change() { observer?.(); }, cleanup() { cleanup(); },
    advance(ms) { const end = now + ms; while (true) { const next = [...timers.entries()].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0]; if (!next) break; const [key, t] = next; now = t.due; if (t.repeat) t.due += t.delay; else timers.delete(key); t.fn(); } now = end; },
    hover(on) { control.hovered = on; control.dispatchEvent(new Event(on ? 'mouseenter' : 'mouseleave')); },
  };
}
const hovered = fixture();
assert.equal(hovered.starts.length, 0);
hovered.hover(true); hovered.advance(2800);
assert.deepEqual(hovered.starts, [0, 1400, 2800], 'Replay starts every 1.4 seconds');
hovered.hover(false); hovered.advance(3000);
assert.equal(hovered.starts.length, 3, 'Leaving stops the loop');
assert.equal(hovered.poses.at(-1), 'initial');
hovered.control.selected = true; hovered.change(); hovered.advance(1400);
assert.equal(hovered.starts.length, 5, 'An active toggle loops without hover');
hovered.control.disabled = true; hovered.change(); hovered.advance(2800);
assert.equal(hovered.starts.length, 5, 'Disabled controls stop even when selected');
hovered.control.disabled = false; hovered.change();
hovered.document.hidden = true; hovered.document.dispatchEvent(new Event('visibilitychange'));
assert.equal(hovered.timers.size, 0, 'Hidden documents stop playback');
hovered.cleanup();
const reduced = fixture({ reduced: true, active: true }); reduced.hover(true); reduced.advance(5000);
assert.equal(reduced.starts.length, 0, 'Reduced motion stays static'); reduced.media.matches = false; reduced.media.dispatchEvent(new Event('change')); reduced.advance(1400);
assert.equal(reduced.starts.length, 2, 'Changing motion preference resumes playback'); reduced.cleanup();
const unmount = fixture({ active: true }); const before = unmount.poses.length; unmount.cleanup();
assert.equal(unmount.timers.size, 0, 'Unmount clears every timer');
assert.equal(unmount.poses.length, before, 'Cleanup never sets poses after Motion unmounts');
console.log('Icon cadence, toggles, disabled state, reduced motion, visibility and cleanup passed.');
