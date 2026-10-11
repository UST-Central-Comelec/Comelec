// Run with: node scripts/test-accounts-unit-filter.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise unit filtering without Next.js. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const React = require("react");

function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", source)(name => dependencies[name] ?? require(name), compiled, compiled.exports);
  return compiled.exports;
}

const { rankUnitLabels, matchesUnit } = load("src/lib/portal/unit-filter.ts");
const cics = "College of Information and Computing Sciences";
const options = ["All units", "Central Comelec", `${cics} (CICS)`, "Faculty of Arts and Letters (AB)", "College of Science (COS)"];
assert.equal(rankUnitLabels(options, "cics")[0], options[2]);
assert.equal(rankUnitLabels(options, "AB")[0], options[3]);
assert.equal(rankUnitLabels(options, "computing")[0], options[2]);
assert.equal(rankUnitLabels(options, "cicss")[0], options[2], "Small abbreviation typos show the nearest college");
assert.equal(rankUnitLabels(options, "centrl")[0], "Central Comelec");
assert.deepEqual(rankUnitLabels(options, "zzzzzzzzz"), []);
assert.deepEqual(rankUnitLabels(options, ""), options);

const central = { affiliation: "central", college: null };
const local = { affiliation: "local", college: cics };
assert.equal(matchesUnit(central, "central"), true);
assert.equal(matchesUnit(local, "central"), false);
assert.equal(matchesUnit(local, cics), true);
assert.equal(matchesUnit(central, cics), false);
assert.equal(matchesUnit({ ...local, college: "College of Science" }, cics), false);
assert.equal(matchesUnit({ affiliation: "osa", college: null }), true);

const routes = [];
const { AccountsUnitFilter } = load("src/components/portal/accounts-unit-filter.tsx", {
  react: { ...React, useId: () => "unit-filter" },
  "next/navigation": { useRouter: () => ({ replace: href => routes.push(href) }), usePathname: () => "/portal/accounts", useSearchParams: () => new URLSearchParams("status=pending&kind=personal&notice=old") },
  "@/components/combobox": { Combobox: () => null },
  "@/lib/applications/options": { unitAbbreviations: { [cics]: "CICS" } },
  "@/lib/portal/unit-filter": { rankUnitLabels },
});
const picker = AccountsUnitFilter({ units: [cics], value: "", showCentral: true }).props.children[1];
picker.props.onChange("cic");
assert.equal(routes.length, 0, "Typing does not change the selected filter before choosing a match");
picker.props.onChange(`${cics} (CICS)`);
const url = new URL(routes[0], "https://portal.test");
assert.equal(url.searchParams.get("unit"), cics);
assert.equal(url.searchParams.get("status"), "pending");
assert.equal(url.searchParams.get("kind"), "personal");
assert.equal(url.searchParams.has("notice"), false);
const localPicker = AccountsUnitFilter({ units: [cics], value: cics, showCentral: false }).props.children[1];
assert.ok(!localPicker.props.options.includes("Central Comelec"));
localPicker.props.onChange("All units");
assert.equal(new URL(routes.at(-1), "https://portal.test").searchParams.has("unit"), false);
console.log("Accounts unit filter passed: full names, abbreviations, nearest matches, scope, and combined filters.");
