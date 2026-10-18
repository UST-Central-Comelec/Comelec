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
    if (name.endsWith(".css")) return {};
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
assert.match(markup, /<input type="hidden"[^>]*name="date" value="2026-10-05"/);
assert.match(markup, /<input type="hidden"[^>]*data-required="true"/, "A required picker marks its value for the form check (form-validation.tsx)");
assert.match(markup, /aria-haspopup="dialog"/);
const typedDate = renderToStaticMarkup(React.createElement(DatePicker, { name: "dateOfBirth", label: "Birthday", defaultValue: "2004-02-29", required: true, editable: true }));
assert.match(typedDate, /type="text"/);
assert.match(typedDate, /placeholder="MM\/DD\/YYYY"/);
assert.match(typedDate, /value="02\/29\/2004"/);
assert.match(typedDate, /autoComplete="bday"/);
assert.match(typedDate, /aria-label="Choose birthday"/);
assert.equal((typedDate.match(/name="dateOfBirth"/g) ?? []).length, 1, "The editable picker sends one named date field");
const birthday = load("src/lib/forms/birthday.ts");
assert.equal(birthday.parseBirthday("2/29/2004"), "2004-02-29");
assert.equal(birthday.parseBirthday("2004-02-29"), "2004-02-29");
for (const invalid of ["02/29/2003", "04/31/2004", "13/01/2004", "01/00/2004", "02/29/04", "29/02/2004", "2004-02-30"]) assert.equal(birthday.parseBirthday(invalid), "", `Reject ${invalid}`);
assert.equal(birthday.ageFromBirthday("10/18/2004", "2026-10-18"), 22);
assert.equal(birthday.ageFromBirthday("10/19/2004", "2026-10-18"), 21);
assert.equal(birthday.ageFromBirthday("02/29/2004", "2026-02-28"), 21);
assert.equal(birthday.birthdayProblem("10/18/2016", "2026-10-18"), null);
assert.ok(birthday.birthdayProblem("10/19/2016", "2026-10-18"));
assert.match(birthday.birthdayProblem("10/19/2026", "2026-10-18"), /future/);
assert.equal(birthday.birthdayProblem("10/18/1906", "2026-10-18"), null);
assert.ok(birthday.birthdayProblem("10/18/1905", "2026-10-18"));
const { TimePicker } = load("src/components/portal/time-picker.tsx");
const time = TimePicker({ name: "time", defaultValue: "09:00" });
assert.equal(time.props.options.find((option) => option.value === "00:00").label, "12:00 AM");
assert.equal(time.props.options.find((option) => option.value === "12:00").label, "12:00 PM");
assert.equal(time.props.options.find((option) => option.value === "23:55").label, "11:55 PM");
assert.equal(TimePicker({ optional: true }).props.options[0].value, "", "Optional ingress and egress can be cleared");
const timeMarkup = renderToStaticMarkup(time);
assert.match(timeMarkup, /9:00 AM/);
assert.match(timeMarkup, /<input type="hidden"[^>]*name="time" value="09:00"/);
assert.match(timeMarkup, /<input type="hidden"[^>]*data-required="true"/, "A time with no None option is required");
console.log("Calendar month/year boundaries, date display, form values, and time dropdown choices passed.");
