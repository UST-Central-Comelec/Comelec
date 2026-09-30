"use client";

import { useId, useState } from "react";
import { Combobox } from "@/components/combobox";
import { colleges } from "@/lib/applications/options";
import { accountRoles, affiliations, type AccountRole, type Affiliation } from "@/lib/data/types";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { Field, FormFooter, usePortalForm } from "./portal-form";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

type Access = { role: AccountRole; affiliation: Affiliation; college: string | null };

const roleHints: Record<AccountRole, string> = {
  commissioner: "Can publish and edit news, documents and members.",
  executive: "Everything a commissioner can do, plus adding accounts and revoking access. Always Central Comelec.",
};

const affiliationHints: Record<Affiliation, string> = {
  central: "Sees the whole portal, and every college’s applicants.",
  local: "Sees only the Directory, Recruitment applications, PolPaR and Filing of Candidacy, and only their own college’s people there.",
};

/** Role, affiliation and college. Picking Executive makes them Central, since executives manage the whole commission. */
function AccessFields({ initial, errors }: { initial: Access; errors: Record<string, string> }) {
  const [role, setRole] = useState<AccountRole>(initial.role);
  const [affiliation, setAffiliation] = useState<Affiliation>(initial.role === "executive" ? "central" : initial.affiliation);
  const [college, setCollege] = useState(initial.college && (colleges as readonly string[]).includes(initial.college) ? initial.college : "");
  const collegeLabel = useId();

  return (
    <>
      <fieldset className={`portal-field is-wide portal-roles${errors.role ? " has-error" : ""}`}>
        <legend className="portal-field-label">Role</legend>
        {Object.entries(accountRoles).map(([value, label]) => (
          <label className="portal-check" key={value}>
            <input
              type="radio"
              name="role"
              value={value}
              checked={role === value}
              onChange={() => {
                setRole(value as AccountRole);
                if (value === "executive") setAffiliation("central");
              }}
            />
            <span><strong>{label}<InfoTip>{roleHints[value as AccountRole]}</InfoTip></strong></span>
          </label>
        ))}
        {errors.role && <span className="portal-field-error">{errors.role}</span>}
      </fieldset>
      <fieldset className={`portal-field portal-roles${errors.affiliation ? " has-error" : ""}`}>
        <legend className="portal-field-label">Affiliation</legend>
        {Object.entries(affiliations).map(([value, label]) => (
          <label className="portal-check" key={value}>
            <input type="radio" name="affiliation" value={value} checked={affiliation === value} onChange={() => setAffiliation(value as Affiliation)} disabled={value === "local" && role === "executive"} />
            <span><strong>{label}<InfoTip>{affiliationHints[value as Affiliation]}</InfoTip></strong></span>
          </label>
        ))}
        {errors.affiliation && <span className="portal-field-error">{errors.affiliation}</span>}
      </fieldset>
      <div className={`portal-field${errors.college ? " has-error" : ""}`}>
        <span className="portal-field-label" id={collegeLabel}>
          College or faculty
          <InfoTip>{affiliation === "local" ? "Their Local Comelec. They only see and manage this college’s people." : "Where they study. Central accounts still see every college."}</InfoTip>
        </span>
        <Combobox name="college" options={colleges} value={college} onChange={setCollege} placeholder="Type or pick a college" invalid={Boolean(errors.college)} labelledBy={collegeLabel} />
        {errors.college && <span className="portal-field-error">{errors.college}</span>}
      </div>
    </>
  );
}

export function NewAccountForm({ action }: { action: FormAction }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="portal-form-grid">
        <Field label="Full name" error={errors.name}>
          <input name="name" maxLength={120} required />
        </Field>
        <Field label="UST email" hint="Their @ust.edu.ph Google account. They sign in with it." error={errors.email}>
          <input name="email" type="email" autoComplete="off" placeholder="name@ust.edu.ph" required />
        </Field>
        <AccessFields initial={{ role: "commissioner", affiliation: "central", college: null }} errors={errors} />
      </div>
      <FormFooter state={state} pending={pending} submitLabel="Add account" cancelHref="/portal/accounts" />
    </form>
  );
}

export function AccountDetailsForm({ action, initial, cancelHref }: { action: FormAction; initial: { name: string } & Access; cancelHref: string }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="portal-form-grid">
        <Field label="Full name" error={errors.name} wide>
          <input name="name" defaultValue={initial.name} maxLength={120} required />
        </Field>
        <AccessFields initial={initial} errors={errors} />
      </div>
      <FormFooter state={state} pending={pending} submitLabel="Save changes" cancelHref={cancelHref} />
    </form>
  );
}
