"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import type { Signatory } from "@/lib/data/types";
import { InfoTip } from "./info-tip";

type Row = Signatory & { key: number };

let nextKey = 0;
const toRows = (list: Signatory[]) => list.map((signatory) => ({ ...signatory, key: nextKey++ }));

/** Editable list of signatories, submitted as one JSON field. Shown on the site as "SGD." lines. */
export function SignatoriesField({ initial, error }: { initial: Signatory[]; error?: string }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initial.length ? initial : [{ name: "", position: "" }]));

  const update = (key: number, field: keyof Signatory, value: string) => setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  const move = (index: number, by: number) =>
    setRows((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });

  return (
    <fieldset className={`portal-field is-wide portal-signatories${error ? " has-error" : ""}`}>
      <legend className="portal-field-label">Signatories<InfoTip>Names and positions only. The website shows “SGD.” in place of each signature; empty rows are ignored.</InfoTip></legend>
      <input type="hidden" name="signatories" value={JSON.stringify(rows.map(({ name, position }) => ({ name, position })))} />
      {rows.map((row, index) => (
        <div className="portal-signatory" key={row.key}>
          <span className="portal-signatory-sgd" aria-hidden="true">SGD.</span>
          <input aria-label={`Signatory ${index + 1} name`} placeholder="Full name" value={row.name} maxLength={120} onChange={(event) => update(row.key, "name", event.target.value)} />
          <input aria-label={`Signatory ${index + 1} position`} placeholder="Position, e.g. Chairperson" value={row.position} maxLength={160} onChange={(event) => update(row.key, "position", event.target.value)} />
          <span className="portal-signatory-actions">
            <button type="button" className="portal-icon-button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button>
            <button type="button" className="portal-icon-button" aria-label="Move down" disabled={index === rows.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button>
            <button type="button" className="portal-icon-button" aria-label="Remove" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}><X size={14} /></button>
          </span>
        </div>
      ))}
      <button type="button" className="portal-button is-ghost is-small portal-signatory-add" onClick={() => setRows((current) => [...current, ...toRows([{ name: "", position: "" }])])}>
        <Plus size={14} /> Add signatory
      </button>
      {error && <span className="portal-field-error">{error}</span>}
    </fieldset>
  );
}
