// Run with: node scripts/test-portal-pickers.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise calendar calculations and form controls without Next.js. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)((name) => {
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? path.resolve("src", name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : `${base}.ts`);
    }
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}
const calendar = load("src/lib/forms/calendar.ts");
assert.equal(calendar.formatPortalDate("2026-10-05"), "October 05, 2026");
assert.equal(calendar.formatPortalDate("2026-02-30"), "", "Impossible dates cannot be displayed as another day");
assert.equal(calendar.shiftCalendarMonth("2028-01-31", 1), "2028-02-29", "Month navigation clamps to leap February");
assert.equal(calendar.shiftCalendarMonth("2027-01-31", 1), "2027-02-28");
assert.equal(calendar.shiftCalendarMonth("2026-12-31", 1), "2027-01-31");
assert.equal(calendar.shiftCalendarDay("2026-03-08", 1), "2026-03-09", "Day navigation is independent of daylight saving");
const days = calendar.calendarDays("2026-10");
assert.equal(days[0], "2026-09-27");
assert.ok(days.includes("2026-10-31"));
assert.equal(new Set(days).size, days.length);
const { DatePicker } = load("src/components/portal/date-picker.tsx");
const markup = renderToStaticMarkup(React.createElement(DatePicker, { name: "date", defaultValue: "2026-10-05", required: true }));
assert.match(markup, /October 05, 2026/);
assert.match(markup, /type="hidden" name="date" value="2026-10-05"/);
assert.match(markup, /aria-haspopup="dialog"/);
const { TimePicker } = load("src/components/portal/time-picker.tsx");
const time = TimePicker({ name: "time", defaultValue: "09:00" });
assert.equal(time.props.options.find((option) => option.value === "00:00").label, "12:00 AM");
assert.equal(time.props.options.find((option) => option.value === "12:00").label, "12:00 PM");
assert.equal(time.props.options.find((option) => option.value === "23:55").label, "11:55 PM");
assert.equal(TimePicker({ optional: true }).props.options[0].value, "", "Optional ingress and egress can be cleared");
const timeMarkup = renderToStaticMarkup(time);
assert.match(timeMarkup, /9:00 AM/);
assert.match(timeMarkup, /type="hidden" name="time" value="09:00"/);
console.log("Calendar month/year boundaries, date display, form values, and time dropdown choices passed.");
