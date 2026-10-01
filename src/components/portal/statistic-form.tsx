"use client";

import { useState, type ReactNode } from "react";
import { StatTable } from "@/components/statistics/stat-table";
import type { FormState } from "@/lib/portal/form";
import { barColumns, columnKinds, parseTable, sizeLabel, toPasteText, type StatisticTable } from "@/lib/statistics/table";
import { InfoTip } from "./info-tip";
import { Field, FormFooter, usePortalForm } from "./portal-form";

type Values = Pick<StatisticTable, "title" | "period" | "asOf" | "summary" | "columns" | "rows" | "barColumn" | "showTotal" | "note">;

/**
 * The form for one of the Statistics page's tables. The figures are pasted as a table (from Excel or
 * Google Sheets, or typed with commas) and previewed underneath as the website will show them, so
 * what's saved is what was seen. `periods` are the groups already in use, offered as suggestions so
 * tables for the same election end up together.
 */
export function StatisticForm({ action, initial, periods, submitLabel, danger }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: Values;
  periods: string[];
  submitLabel: string;
  danger?: ReactNode;
}) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const [data, setData] = useState(() => (initial.columns.length ? toPasteText(initial) : ""));
  const [bar, setBar] = useState(initial.barColumn === null ? "" : String(initial.barColumn));
  const [showTotal, setShowTotal] = useState(initial.showTotal);

  const grid = data.trim() ? parseTable(data) : null;
  const table = grid && !("error" in grid) ? grid : null;
  const kinds = table ? columnKinds(table) : [];
  const figures = barColumns(kinds);
  // A choice the table no longer has figures for (a column removed, or turned to words) falls back to none.
  const barColumn = bar !== "" && figures.includes(Number(bar)) ? Number(bar) : null;
  const canTotal = kinds.includes("number");

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <fieldset className="portal-form-section">
        <legend>The table</legend>
        <div className="portal-form-grid">
          <Field label="Title" hint="What the table shows, e.g. Voter turnout by college." error={errors.title} wide>
            <input name="title" defaultValue={initial.title} maxLength={140} required />
          </Field>
          <Field label="Election or period" hint="Tables with the same wording here are shown together on the Statistics page, e.g. 2026 Central Student Council Elections. Pick one already in use to add to it." error={errors.period}>
            <input name="period" list="statistic-periods" defaultValue={initial.period} maxLength={100} autoComplete="off" required />
            <datalist id="statistic-periods">{periods.map((period) => <option key={period} value={period} />)}</datalist>
          </Field>
          <Field label="Figures as of" hint="The day the figures were counted or last checked. The page shows the most recent tables first." error={errors.asOf}>
            <input name="asOf" type="date" defaultValue={initial.asOf} required />
          </Field>
          <Field label="Short description" hint="Optional. One or two sentences on what the table shows, above the figures." error={errors.summary} wide>
            <textarea name="summary" rows={2} defaultValue={initial.summary} maxLength={300} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="portal-form-section">
        <legend>Figures</legend>
        <div className="portal-form-grid">
          <Field
            label="Paste the table"
            hint="Copy the cells in Excel or Google Sheets, headings included, and paste them here. Or type it: one row per line, with commas between cells, the headings on the first line. The first column names each row."
            // What's in the box now decides: the server's complaint about an earlier paste goes once it's fixed.
            error={grid ? ("error" in grid ? grid.error : undefined) : errors.data}
            wide
          >
            <textarea
              className="portal-stat-input"
              name="data"
              rows={9}
              value={data}
              onChange={(event) => setData(event.target.value)}
              placeholder={"College, Registered voters, Votes cast, Turnout\nFaculty of Arts and Letters, 3210, 1840, 57.3%\nCollege of Science, 2450, 1502, 61.3%"}
              spellCheck={false}
              wrap="off"
              required
            />
          </Field>
          <Field label="Draw bars for" hint="Optional. One column of figures can have a bar beside each number, so the rows are easy to compare. Percentages are drawn out of 100.">
            <select name="barColumn" value={barColumn === null ? "" : String(barColumn)} onChange={(event) => setBar(event.target.value)} disabled={!figures.length}>
              <option value="">No bars</option>
              {table && figures.map((index) => <option key={index} value={index}>{table.columns[index]}</option>)}
            </select>
          </Field>
          <label className="portal-check portal-stat-total">
            <input name="showTotal" type="checkbox" checked={showTotal && canTotal} onChange={(event) => setShowTotal(event.target.checked)} disabled={!canTotal} />
            <span><strong>Add a row of totals<InfoTip>Adds up each column of counts at the foot of the table. Columns of percentages and words are left blank.</InfoTip></strong></span>
          </label>
          <Field label="Note or source" hint="Optional. Where the figures come from, or how to read them. Shown under the table." error={errors.note} wide>
            <input name="note" defaultValue={initial.note} maxLength={400} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="portal-form-section">
        <legend>Preview</legend>
        {table ? (
          <>
            <p className="portal-muted portal-stat-size">{sizeLabel(table)}, as the Statistics page will show it.</p>
            <div className="portal-stat-preview" role="region" aria-label="Preview of the table" tabIndex={0}>
              <StatTable prefix="portal-stat" table={table} barColumn={barColumn} showTotal={showTotal && canTotal} label="Preview of the table" />
            </div>
          </>
        ) : (
          <p className="portal-empty portal-stat-waiting">Paste or type the table above to see it here.</p>
        )}
      </fieldset>

      <FormFooter state={state} pending={pending} submitLabel={submitLabel} cancelHref="/portal/statistics" danger={danger} />
    </form>
  );
}
