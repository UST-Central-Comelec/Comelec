"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { Combobox } from "@/components/combobox";
import { colleges } from "@/lib/applications/options";
import { CENTRAL_REPRESENTATIVE, CHAIRPERSON, memberBodies, positionsFor, type Member, type MemberBody } from "@/lib/data/types";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { PhotoInput } from "./photo-input";
import { Field, FormFooter, usePortalForm } from "./portal-form";

type Values = Pick<Member, "name" | "position" | "body" | "unit" | "photoUrl">;

/**
 * `takenColleges` maps each college that already has a Central Representative (other than this
 * member) to that person's name; the server checks it again on save. `lockedCollege` (a Local
 * account's college) fixes the member to that college's Local Comelec.
 */
export function MemberForm({
  action,
  initial,
  submitLabel,
  takenColleges,
  lockedCollege,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: Values;
  submitLabel: string;
  takenColleges: Record<string, string>;
  lockedCollege?: string;
}) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const [body, setBody] = useState<MemberBody>(initial.body);
  const [position, setPosition] = useState(positionsFor(initial.body).includes(initial.position) ? initial.position : "");
  const [college, setCollege] = useState((colleges as readonly string[]).includes(initial.unit) ? initial.unit : "");
  const collegeLabel = useId();
  const local = body === "local";
  const representative = local && position === CENTRAL_REPRESENTATIVE;
  // Checked again on save; this just says so before they submit.
  const takenBy = representative && college ? takenColleges[college] : undefined;

  const changeBody = (next: MemberBody) => {
    setBody(next);
    // Central Representative is a Local Comelec position only.
    if (!positionsFor(next).includes(position)) setPosition("");
  };

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="portal-form-grid">
        <Field label="Full name" error={errors.name}>
          <input name="name" defaultValue={initial.name} maxLength={120} required />
        </Field>
        <Field label="Serves in" error={errors.body}>
          {lockedCollege !== undefined && <input type="hidden" name="body" value="local" />}
          <select name={lockedCollege !== undefined ? undefined : "body"} value={body} onChange={(event) => changeBody(event.target.value as MemberBody)} disabled={lockedCollege !== undefined}>
            {Object.entries(memberBodies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field
          label="Position"
          hint={
            local
              ? `A college’s ${CENTRAL_REPRESENTATIVE} is also listed under En Banc, and its ${CHAIRPERSON} under the Chamber of Chairpersons.`
              : "The Central Comelec is its Executive Board, so everyone here is also listed under En Banc."
          }
          error={errors.position}
        >
          <select name="position" value={position} onChange={(event) => setPosition(event.target.value)} required>
            <option value="" disabled>Select position</option>
            {positionsFor(body).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        {/* Same list and picker as the application form, for both groups: required for Local
            Comelec, optional for Central. Not a <label>: the picker has its own list to click. */}
        <div className={`portal-field${errors.unit || takenBy ? " has-error" : ""}`}>
          <span className="portal-field-label" id={collegeLabel}>
            {local ? "College or faculty" : "College or faculty (optional)"}
            <InfoTip>
              {representative
                ? "The college they represent. Each college has one Central Representative."
                : local
                  ? "The college whose Local Comelec they serve in."
                  : "Shown under their name on the website. Clear the field to leave it out."}
            </InfoTip>
          </span>
          {lockedCollege !== undefined ? (
            <input className="is-fixed" name="unit" value={lockedCollege} readOnly aria-labelledby={collegeLabel} />
          ) : (
            <Combobox name="unit" options={colleges} value={college} onChange={setCollege} placeholder="Type or pick a college" invalid={Boolean(errors.unit || takenBy)} labelledBy={collegeLabel} />
          )}
          {takenBy ? (
            <span className="portal-field-error">{takenBy} is already this college’s Central Representative. Change or remove them first.</span>
          ) : (
            errors.unit && <span className="portal-field-error">{errors.unit}</span>
          )}
        </div>
        <Field label={initial.photoUrl ? "Replace photo (optional)" : "Photo (optional)"} hint="JPG, PNG or WebP. Large photos are compressed automatically. A square photo works best." error={errors.photo}>
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
