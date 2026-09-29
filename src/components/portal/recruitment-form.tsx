"use client";

import { divisions, type DivisionId, type SlotCounts } from "@/lib/applications/options";
import type { FormState } from "@/lib/portal/form";
import { Field, FormFooter, usePortalForm } from "./portal-form";

export function RecruitmentForm({ action, slots }: { action: (state: FormState, formData: FormData) => Promise<FormState>; slots: SlotCounts }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="portal-recruitment">
        {(Object.entries(divisions) as Array<[DivisionId, (typeof divisions)[DivisionId]]>).map(([division, item]) => (
          <section className="portal-card" key={division}>
            <h2 className="portal-card-title">{item.label}</h2>
            <div className="portal-form-grid">
              {Object.entries(item.positions).map(([id, label]) => (
                <Field key={id} label={label} error={errors[`slots-${id}`]}>
                  <input name={`slots-${id}`} type="number" inputMode="numeric" min={0} max={999} step={1} defaultValue={slots[id] ?? 0} />
                  {/* The count this page loaded with, so saving only touches the ones you changed. */}
                  <input name={`loaded-${id}`} type="hidden" value={slots[id] ?? 0} />
                </Field>
              ))}
            </div>
          </section>
        ))}
      </div>
      <FormFooter state={state} pending={pending} submitLabel="Save slots" cancelHref="/portal" />
    </form>
  );
}
