"use client";

import Link from "next/link";
import { useState } from "react";
import { AddIcon } from "@/components/action-icons";
import { openingsForUnit, type SlotCounts } from "@/lib/applications/options";
import type { FormState } from "@/lib/portal/form";
import { FormFooter, usePortalForm } from "./portal-form";
import { TitleWithInfo } from "./info-tip";

/**
 * Recruitment → Slots: each office of the unit, with a counter for every role it can recruit (its
 * Executive Board seat, Executive Associates, and the roles the unit added in the Database).
 */
export function RecruitmentForm({ action, slots, unit = "", addRolesHref }: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  slots: SlotCounts;
  unit?: string;
  /** Where "Add roles" goes (Database → Roles); left out for accounts that can't open it. */
  addRolesHref?: string;
}) {
  const { pending, onSubmit, errors } = usePortalForm(action);
  const openings = openingsForUnit(unit);
  const ids = openings.map(({ id }) => id);
  const offices = [...new Set(openings.map((opening) => opening.officeId))].map((officeId) => openings.filter((opening) => opening.officeId === officeId));
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(ids.map((id) => [id, String(slots[id] ?? 0)])));
  const count = (id: string) => {
    const value = Number(counts[id]);
    return Number.isInteger(value) && value >= 0 && value <= 999 ? value : 0;
  };
  const edited = (id: string) => counts[id] !== String(slots[id] ?? 0);
  const open = ids.filter((id) => count(id) > 0).length;
  const changed = ids.filter(edited).length;

  return (
    <form onSubmit={onSubmit} noValidate className="recruitment-slots-form">
      <input type="hidden" name="unit" value={unit} />
      <div className="recruitment-slots-summary" aria-live="polite">
        <div><strong>{ids.reduce((total, id) => total + count(id), 0)}</strong><span>Open slots</span></div>
        <div><strong>{open}<small> / {ids.length}</small></strong><span>Open roles</span></div>
        <div><strong>{changed}</strong><span>Unsaved changes</span></div>
      </div>
      <div className="portal-recruitment">
        <section className="portal-card" aria-labelledby="recruitment-offices-title">
          <header className="portal-card-head">
            <TitleWithInfo as="h2" className="portal-card-title" id="recruitment-offices-title" info="Each office of the unit’s Executive Board, from Administrative → Database → Positions, with the roles it can recruit. Executive Board and Executive Associate are every unit’s; the rest are roles this unit added under Database → Roles.">Offices</TitleWithInfo>
            {addRolesHref && <Link className="portal-button is-ghost is-small" href={addRolesHref}><AddIcon size={14} aria-hidden="true" />Add roles</Link>}
          </header>
          <div className="recruitment-office-list">
            {offices.map((roles) => {
              const { officeId, office } = roles[0];
              const openHere = roles.reduce((total, { id }) => total + count(id), 0);
              return (
                <section className="recruitment-office" key={officeId} aria-labelledby={`office-${officeId}`}>
                  <header className="recruitment-office-head">
                    <h3 id={`office-${officeId}`}>{office}</h3>
                    <span className={openHere ? "is-open" : ""}>{openHere ? `${openHere} open` : "Closed"}</span>
                  </header>
                  {roles.map(({ id, label, roleName }) => (
                    <div className={`recruitment-position${errors[`slots-${id}`] ? " has-error" : ""}`} key={id}>
                      <div className="recruitment-position-label">
                        <label htmlFor={`slots-${id}`}>{roleName}</label>
                        <span className={count(id) > 0 ? "is-open" : ""}>{count(id) > 0 ? "Open for applications" : "Closed"}{edited(id) ? " · Edited" : ""}</span>
                      </div>
                      <div className="portal-field recruitment-position-count">
                        <input id={`slots-${id}`} aria-label={`${label}: open slots`} aria-invalid={Boolean(errors[`slots-${id}`])} aria-describedby={errors[`slots-${id}`] ? `error-${id}` : undefined} name={`slots-${id}`} type="number" inputMode="numeric" min={0} max={999} step={1} value={counts[id]} onChange={(event) => setCounts((current) => ({ ...current, [id]: event.target.value }))} disabled={pending} />
                        <input name={`loaded-${id}`} type="hidden" value={slots[id] ?? 0} />
                      </div>
                      {errors[`slots-${id}`] && <span id={`error-${id}`} className="portal-field-error recruitment-position-error">{errors[`slots-${id}`]}</span>}
                    </div>
                  ))}
                </section>
              );
            })}
            {!offices.length && <p className="portal-empty">This unit has no offices yet. Add them under Administrative → Database → Positions.</p>}
          </div>
        </section>
      </div>
      <FormFooter pending={pending} submitLabel={changed ? `Save ${changed} ${changed === 1 ? "change" : "changes"}` : "Save slots"} cancelHref="/portal" />
    </form>
  );
}
