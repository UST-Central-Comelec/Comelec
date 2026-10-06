"use client";

import { useState } from "react";
import { positionsForUnit, type SlotCounts } from "@/lib/applications/options";
import type { FormState } from "@/lib/portal/form";
import { FormFooter, usePortalForm } from "./portal-form";

export function RecruitmentForm({ action, slots, unit = "" }: { action: (state: FormState, formData: FormData) => Promise<FormState>; slots: SlotCounts; unit?: string }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const choices = positionsForUnit(unit);
  const positions = choices.map(({ id }) => id);
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(positions.map((id) => [id, String(slots[id] ?? 0)])));
  const count = (id: string) => {
    const value = Number(counts[id]);
    return Number.isInteger(value) && value >= 0 && value <= 999 ? value : 0;
  };
  const open = positions.filter((id) => count(id) > 0).length;
  const changed = positions.filter((id) => counts[id] !== String(slots[id] ?? 0)).length;

  return (
    <form onSubmit={onSubmit} noValidate className="recruitment-slots-form">
      <input type="hidden" name="unit" value={unit} />
      <div className="recruitment-slots-summary" aria-live="polite">
        <div><strong>{positions.reduce((total, id) => total + count(id), 0)}</strong><span>Open slots</span></div>
        <div><strong>{open}<small> / {positions.length}</small></strong><span>Open positions</span></div>
        <div><strong>{changed}</strong><span>Unsaved changes</span></div>
      </div>
      <div className="portal-recruitment">
        <section className="portal-card">
          <h2 className="portal-card-title">Positions</h2>
          <div className="recruitment-position-list">
            {choices.map(({ id, label }) => (
              <div className={`recruitment-position${errors[`slots-${id}`] ? " has-error" : ""}`} key={id}>
                <div className="recruitment-position-label">
                  <label htmlFor={`slots-${id}`}>{label}</label>
                  <span className={count(id) > 0 ? "is-open" : ""}>{count(id) > 0 ? "Open for applications" : "Closed"}{counts[id] !== String(slots[id] ?? 0) ? " · Edited" : ""}</span>
                </div>
                <div className="portal-field recruitment-position-count">
                  <input id={`slots-${id}`} aria-label={`${label}: open slots`} aria-invalid={Boolean(errors[`slots-${id}`])} aria-describedby={errors[`slots-${id}`] ? `error-${id}` : undefined} name={`slots-${id}`} type="number" inputMode="numeric" min={0} max={999} step={1} value={counts[id]} onChange={(event) => setCounts((current) => ({ ...current, [id]: event.target.value }))} disabled={pending} />
                  <input name={`loaded-${id}`} type="hidden" value={slots[id] ?? 0} />
                </div>
                {errors[`slots-${id}`] && <span id={`error-${id}`} className="portal-field-error recruitment-position-error">{errors[`slots-${id}`]}</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
      <FormFooter state={state} pending={pending} submitLabel={changed ? `Save ${changed} ${changed === 1 ? "change" : "changes"}` : "Save slots"} cancelHref="/portal" />
    </form>
  );
}
