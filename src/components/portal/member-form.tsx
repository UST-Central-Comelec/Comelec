"use client";

import Image from "next/image";
import { memberBodies, type Member } from "@/lib/data/types";
import type { FormState } from "@/lib/portal/form";
import { PhotoInput } from "./photo-input";
import { Field, FormFooter, usePortalForm } from "./portal-form";

type Values = Pick<Member, "name" | "position" | "body" | "unit" | "order" | "photoUrl">;

export function MemberForm({ action, initial, submitLabel }: { action: (state: FormState, formData: FormData) => Promise<FormState>; initial: Values; submitLabel: string }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="portal-form-grid">
        <Field label="Full name" error={errors.name}>
          <input name="name" defaultValue={initial.name} maxLength={120} required />
        </Field>
        <Field label="Position" hint="e.g. Chairperson, Commissioner" error={errors.position}>
          <input name="position" defaultValue={initial.position} maxLength={120} required />
        </Field>
        <Field label="Serves in" error={errors.body}>
          <select name="body" defaultValue={initial.body}>
            {Object.entries(memberBodies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="College or faculty" hint="Optional — shown for Local Comelec members." error={errors.unit}>
          <input name="unit" defaultValue={initial.unit} maxLength={120} />
        </Field>
        <Field label="Display order" hint="Lower numbers appear first." error={errors.order}>
          <input name="order" type="number" min={0} max={999} step={1} defaultValue={initial.order} />
        </Field>
        <Field label={initial.photoUrl ? "Replace photo" : "Photo"} hint="Optional — JPG, PNG or WebP. Large photos are compressed automatically. A square photo works best." error={errors.photo}>
          <PhotoInput name="photo" />
        </Field>
        {initial.photoUrl && (
          <div className="portal-photo-current is-wide">
            <Image src={initial.photoUrl} alt="" width={56} height={56} />
            <label className="portal-check">
              <input name="removePhoto" type="checkbox" />
              <span><strong>Remove current photo</strong></span>
            </label>
          </div>
        )}
      </div>
      <FormFooter state={state} pending={pending} submitLabel={submitLabel} cancelHref="/portal/members" />
    </form>
  );
}
