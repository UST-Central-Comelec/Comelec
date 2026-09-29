"use client";

import { accountRoles, type AccountRole } from "@/lib/data/types";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { Field, FormFooter, usePortalForm } from "./portal-form";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

const roleHints: Record<AccountRole, string> = {
  commissioner: "Can publish and edit news, documents and members.",
  executive: "Everything a commissioner can do, plus adding accounts and revoking access.",
};

function RoleField({ defaultValue, error }: { defaultValue: AccountRole; error?: string }) {
  return (
    <fieldset className={`portal-field is-wide portal-roles${error ? " has-error" : ""}`}>
      <legend className="portal-field-label">Role</legend>
      {Object.entries(accountRoles).map(([value, label]) => (
        <label className="portal-check" key={value}>
          <input type="radio" name="role" value={value} defaultChecked={value === defaultValue} />
          <span><strong>{label}<InfoTip>{roleHints[value as AccountRole]}</InfoTip></strong></span>
        </label>
      ))}
      {error && <span className="portal-field-error">{error}</span>}
    </fieldset>
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
        <RoleField defaultValue="commissioner" error={errors.role} />
      </div>
      <FormFooter state={state} pending={pending} submitLabel="Add account" cancelHref="/portal/accounts" />
    </form>
  );
}

export function AccountDetailsForm({ action, initial, cancelHref }: { action: FormAction; initial: { name: string; role: AccountRole }; cancelHref: string }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="portal-form-grid">
        <Field label="Full name" error={errors.name} wide>
          <input name="name" defaultValue={initial.name} maxLength={120} required />
        </Field>
        <RoleField defaultValue={initial.role} error={errors.role} />
      </div>
      <FormFooter state={state} pending={pending} submitLabel="Save changes" cancelHref={cancelHref} />
    </form>
  );
}
