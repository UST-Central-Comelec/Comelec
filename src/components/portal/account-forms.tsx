"use client";

import Image from "next/image";
import { useId, useState, type ReactNode } from "react";
import { Building2, UserRound } from "lucide-react";
import { digitsOnly } from "@/lib/applications/numeric-input";
import { Combobox } from "@/components/combobox";
import { FacebookProfileInput } from "@/components/facebook-profile-input";
import { comelecUnits, yearLevelsFor } from "@/lib/applications/options";
import { detailsFor, officialName, positionsFor, programsOf } from "@/lib/data/accounts";
import { accountAffiliations, accountKinds, accountPositions, type AccountAffiliation, type AccountKind, type AccountPosition, type AccountSummary } from "@/lib/data/types";
import { canManageAccount, grantablePositions, type Manager } from "@/lib/portal/account-scope";
import type { FormState } from "@/lib/portal/form";
import { Dropdown } from "./dropdown";
import { InfoTip } from "./info-tip";
import { PhotoInput } from "./photo-input";
import { Field, FormFooter, uppercaseInput, usePortalForm } from "./portal-form";
import { RoleSelect, useRoleChoice } from "./role-field";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

export type AccountValues = Pick<AccountSummary, "kind" | "lastName" | "firstName" | "middleInitial" | "middleName" | "yearLevel" | "studentNumber" | "affiliation" | "position" | "role" | "college" | "program" | "facebookUrl" | "photoUrl">;

const affiliationHints: Record<AccountAffiliation, string> = {
  central: "Serves in the Central Comelec. Sees every unit’s records in the tabs open to them.",
  local: "Serves in their college’s Local Comelec. Sees only that college’s records, in the tabs a Local account can have.",
  osa: "The Office for Student Affairs. Its accounts are Admins: they see everything, and change nothing.",
};

const positionHints: Record<AccountPosition, string> = {
  "executive-board": "Opens everything, the Administrative tab included, unless that’s changed under Accounts → Access Control.",
  "executive-associate": "Opens everything but the Administrative tab, unless that’s changed under Accounts → Access Control.",
  deputy: "Opens Recruitment, Political Party and Filing of Candidacy, unless that’s changed under Accounts → Access Control.",
  adviser: "View only. A Central adviser sees everything; a Local adviser sees their own college’s records. An adviser has no role, program or student ID.",
  admin: "View only, for everything. An admin has no role, college, program or student ID.",
};

const kindIcons = { personal: UserRound, official: Building2 };

const emptyAccount: AccountValues = { kind: "personal", lastName: "", firstName: "", middleInitial: "", middleName: "", yearLevel: null, studentNumber: null, affiliation: "central", position: "executive-associate", role: "", college: null, program: null, facebookUrl: null, photoUrl: null };

/** A detail the position doesn't have, shown as a fixed field so the form reads the same for everyone. */
function NotApplicable({ label, hint }: { label: string; hint: string }) {
  return (
    <Field label={label} hint={hint}>
      <input className="is-fixed" value="None" readOnly />
    </Field>
  );
}

/**
 * An account's details, in the order they're kept: name, UST email, student ID, affiliation,
 * college beside affiliation, position beside role, program, year level and Facebook link. The email is asked for on a new account only
 * (`askEmail`; `email` fills it in); afterwards it's what they sign in with, and is only shown.
 *
 * Which details there are follows from the picks (detailsFor): an Adviser or Admin has no role,
 * program or student ID, an Admin no college, and the Office for Student Affairs' accounts are
 * Admins. An official account has only its email and its unit.
 *
 * `fixedUnit` holds the category, affiliation, position and college in place: for someone editing
 * their own account (those are another manager's to change) and for the built-in executive. A Local
 * manager can only add to their own college's Local Comelec. The server checks all of this again.
 * `danger` is what sits at the footer's left: revoking, restoring and deleting.
 */
export function AccountForm({ action, initial = emptyAccount, manager, askEmail, email, fixedUnit, submitLabel, cancelHref, danger }: { action: FormAction; initial?: AccountValues; manager: Manager; askEmail?: boolean; email?: string; fixedUnit?: boolean; submitLabel: string; cancelHref: string; danger?: ReactNode }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const localManager = manager.affiliation === "local";
  // Official accounts are the Central Executive Board's to add.
  const canAddOfficial = canManageAccount(manager, { kind: "official", affiliation: "central", position: "executive-board", college: null });
  const [kind, setKind] = useState<AccountKind>(initial.kind);
  const official = kind === "official";

  const lockedCollege = fixedUnit ? (initial.affiliation === "local" ? initial.college : null) : localManager ? manager.college : null;
  const [college, setCollege] = useState(lockedCollege ?? (initial.college && comelecUnits.includes(initial.college) ? initial.college : ""));

  const startAffiliation: AccountAffiliation = localManager && !fixedUnit ? "local" : initial.affiliation;
  const startPositions = grantablePositions(manager, startAffiliation);
  const { affiliation: pickedAffiliation, setAffiliation, position, role, setRole, setPositionAndRole, options } = useRoleChoice({
    affiliation: startAffiliation,
    position: fixedUnit || startPositions.includes(initial.position) ? initial.position : (startPositions.at(-1) ?? ""),
    role: initial.role,
  }, college);
  // Always picked here: the form starts on one.
  const affiliation = pickedAffiliation || startAffiliation;
  // What this manager may pick. An affiliation is on offer if they can add someone to it at all.
  const affiliationOptions = (Object.keys(accountAffiliations) as AccountAffiliation[])
    .filter((value) => (official ? value !== "osa" : fixedUnit || value === affiliation || grantablePositions(manager, value).length > 0))
    .map((value) => ({ value, label: accountAffiliations[value] }));
  const positionOptions = positionsFor(affiliation).map((value) => ({
    value,
    label: accountPositions[value],
    disabled: !fixedUnit && !grantablePositions(manager, affiliation).includes(value),
  }));
  const needs = position ? detailsFor(affiliation, position) : { role: true, studentNumber: true, program: true, college: "required" as const };

  const programs = programsOf(college);
  const [program, setProgram] = useState(initial.program && programs.includes(initial.program) ? initial.program : "");
  const levels = yearLevelsFor(college);
  const [yearLevel, setYearLevel] = useState(initial.yearLevel && Object.hasOwn(levels, initial.yearLevel) ? initial.yearLevel : "");
  const collegeLabel = useId();
  const programLabel = useId();
  const affiliationLabel = useId();
  const positionLabel = useId();
  const fixedAffiliation = Boolean(fixedUnit) || localManager;
  // An official account is Central or Local, never the Office for Student Affairs'.
  const officialAffiliation = affiliation === "local" ? "local" : "central";

  const collegeField = (required: boolean, hint: string) => (
    // Not a <label>: the picker has its own list to click.
    <div className={`portal-field${errors.college ? " has-error" : ""}`}>
      <span className="portal-field-label" id={collegeLabel}>
        {required ? "College or faculty" : "College or faculty (optional)"}
        <InfoTip>{hint}</InfoTip>
      </span>
      {lockedCollege !== null ? (
        <input className="is-fixed" name="college" value={lockedCollege} readOnly aria-labelledby={collegeLabel} />
      ) : (
        <Combobox name="college" options={comelecUnits} value={college} onChange={(next) => { if (next === college) return; setCollege(next); setProgram(""); setYearLevel(""); }} placeholder="Type or pick a college" invalid={Boolean(errors.college)} labelledBy={collegeLabel} />
      )}
      {errors.college && <span className="portal-field-error">{errors.college}</span>}
    </div>
  );

  const emailField = (
    <Field label="UST email" hint={askEmail ? "The @ust.edu.ph Google account they sign in with. It’s marked verified the first time they do." : "What they sign in with. It can’t be changed: to move to another email, revoke this account and add a new one."} error={errors.email}>
      {/* Only a new account sends it; afterwards it's shown, not saved. */}
      {email ? <input className="is-fixed" name={askEmail ? "email" : undefined} type="email" value={email} readOnly /> : <input name="email" type="email" autoComplete="off" pattern={"[^@\\s]+@ust\\.edu\\.ph"} title="Use an @ust.edu.ph email address" placeholder="name@ust.edu.ph" onInput={(event) => { if (/^[^@\s]*@$/.test(event.currentTarget.value)) event.currentTarget.value += "ust.edu.ph"; }} required />}
    </Field>
  );

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <input type="hidden" name="kind" value={kind} />
      {canAddOfficial && !fixedUnit && (
        <fieldset className="portal-form-section">
          <legend>Category</legend>
          <div className="portal-segmented" role="radiogroup" aria-label="Category">
            {(Object.keys(accountKinds) as AccountKind[]).map((value) => {
              const KindIcon = kindIcons[value];
              return (
                <label key={value} className={`portal-segment${kind === value ? " is-selected" : ""}`}>
                  <input type="radio" value={value} checked={kind === value} onChange={() => setKind(value)} />
                  <KindIcon size={15} strokeWidth={1.9} aria-hidden="true" />
                  {accountKinds[value]}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {official ? (
        <fieldset className="portal-form-section">
          <legend>Official account</legend>
          <div className="portal-form-grid">
            {emailField}
            <div className={`portal-field${errors.affiliation ? " has-error" : ""}`}>
              <span className="portal-field-label" id={affiliationLabel}>Unit<InfoTip>The Central Comelec’s account, or a college’s Local Comelec’s.</InfoTip></span>
              <Dropdown name="affiliation" labelledBy={affiliationLabel} value={officialAffiliation} onChange={(next) => setAffiliation(next as AccountAffiliation)} options={affiliationOptions} disabled={fixedAffiliation} />
              {errors.affiliation && <span className="portal-field-error">{errors.affiliation}</span>}
            </div>
            {officialAffiliation === "local" && collegeField(true, "The college whose Local Comelec this account belongs to. It only sees and manages that college’s records.")}
            <Field label="Name" hint="An official account is named after its unit.">
              <input className="is-fixed" value={officialName(officialAffiliation, college)} readOnly />
            </Field>
          </div>
        </fieldset>
      ) : (
        <>
          <fieldset className="portal-form-section">
            <legend>Name</legend>
            <div className="portal-form-grid portal-account-name">
              <Field label="Last name" error={errors.lastName}>
                <input name="lastName" defaultValue={initial.lastName} autoComplete="off" autoCapitalize="characters" maxLength={80} onInput={uppercaseInput} required />
              </Field>
              <Field label="First name" error={errors.firstName}>
                <input name="firstName" defaultValue={initial.firstName} autoComplete="off" autoCapitalize="characters" maxLength={80} onInput={uppercaseInput} required />
              </Field>
              <Field label="Middle name" error={errors.middleName}>
                <input name="middleName" defaultValue={initial.middleName || initial.middleInitial} autoComplete="off" autoCapitalize="characters" maxLength={80} onInput={uppercaseInput} required />
              </Field>
            </div>
          </fieldset>

          <fieldset className="portal-form-section">
            <legend>UST account</legend>
            <div className="portal-form-grid">
              {emailField}
              {needs.studentNumber ? (
                <Field label="Student ID" error={errors.studentNumber}>
                  <input name="studentNumber" defaultValue={initial.studentNumber ?? ""} inputMode="numeric" pattern="[0-9]{10}" autoComplete="off" maxLength={10} placeholder="2023123456" onInput={(event) => { event.currentTarget.value = digitsOnly(event.currentTarget.value, 10); }} required />
                </Field>
              ) : (
                <NotApplicable label="Student ID" hint="Advisers and admins aren’t students, so they have no student ID." />
              )}
            </div>
          </fieldset>

          <fieldset className="portal-form-section">
            <legend>In the commission</legend>
            <div className="portal-form-grid">
              <div className={`portal-field${errors.affiliation ? " has-error" : ""}`}>
                <span className="portal-field-label" id={affiliationLabel}>Affiliation<InfoTip>{affiliationHints[affiliation]}</InfoTip></span>
                <Dropdown name="affiliation" labelledBy={affiliationLabel} value={affiliation} onChange={(next) => setAffiliation(next as AccountAffiliation)} options={affiliationOptions} disabled={fixedAffiliation} />
                {errors.affiliation && <span className="portal-field-error">{errors.affiliation}</span>}
              </div>
              {needs.college === "none" ? (
                <NotApplicable label="College or faculty" hint="Admins belong to the Office for Student Affairs, not to a college." />
              ) : (
                collegeField(needs.college === "required", !needs.program ? (affiliation === "local" ? "The college whose Local Comelec they advise. They only see that college’s records." : "The college they belong to, if you want it on record. Central advisers still see every college.") : affiliation === "local" ? "Their Local Comelec. They only see and manage this college’s records." : "Where they study. Central accounts still see every college.")
              )}
              <div className={`portal-field${errors.position ? " has-error" : ""}`}>
                <span className="portal-field-label" id={positionLabel}>Position<InfoTip>{position ? positionHints[position] : "Pick their position."}</InfoTip></span>
                {/* The Office for Student Affairs has one position, so there's nothing to pick. */}
                <input type="hidden" name="position" value={position} />
                <Dropdown labelledBy={positionLabel} value={position} onChange={(next) => setPositionAndRole(next as AccountPosition, "")} options={positionOptions} placeholder="Select position" disabled={fixedUnit || positionOptions.length < 2} />
                {errors.position && <span className="portal-field-error">{errors.position}</span>}
              </div>
              <Field
                label="Role"
                hint={!needs.role ? "Advisers and admins have no role. The Directory lists an adviser as “Adviser”." : position === "deputy" ? "Deputies have one role, so it’s filled in." : position === "executive-associate" ? "The board member’s office they serve in." : "Their seat on the Executive Board. This is how the Directory and the website’s About page list them."}
                error={errors.role}
              >
                <RoleSelect name="role" position={position} role={role} options={options} onChange={setRole} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="portal-form-section">
            <legend>{needs.program ? "Studies and contact" : "Contact"}</legend>
            <div className="portal-form-grid">
              {!needs.program ? (
                <NotApplicable label="Program" hint="Advisers and admins aren’t students, so they have no program." />
              ) : college && programs.length === 0 ? (
                <NotApplicable label="Program" hint="This school has no program to select." />
              ) : (
                <div className={`portal-field${errors.program ? " has-error" : ""}`}>
                  <span className="portal-field-label" id={programLabel}>Program</span>
                  <Combobox key={college} name="program" options={programs} value={program} onChange={setProgram} placeholder={college ? "Type or pick a program" : "Pick a college first"} emptyText="No match. Try another program." disabled={!college} invalid={Boolean(errors.program)} labelledBy={programLabel} />
                  {errors.program && <span className="portal-field-error">{errors.program}</span>}
                </div>
              )}
              {needs.program ? (
                <Field label="Year level" error={errors.yearLevel}>
                  <Dropdown name="yearLevel" invalid={Boolean(errors.yearLevel)} value={yearLevel} onChange={setYearLevel} options={Object.entries(levels).map(([value, label]) => ({ value, label }))} placeholder="Select year level" />
                </Field>
              ) : <NotApplicable label="Year level" hint="Advisers and admins have no year level." />}
              {affiliation === "local" && college && (
                <Field label="Local unit" hint="Assigned from their Local affiliation and college or faculty. This account only accesses this unit’s records." wide>
                  <input className="is-fixed" value={`${college} Local Comelec`} readOnly />
                </Field>
              )}
              <Field label="Facebook link (optional)" hint="Enter their Facebook username or paste their profile link. Shown beside their name in the portal’s Directory." error={errors.facebookUrl} wide>
                <FacebookProfileInput defaultValue={initial.facebookUrl ?? ""} invalid={Boolean(errors.facebookUrl)} />
              </Field>
            </div>
          </fieldset>

          {/* Commissioners and advisers are listed in the Directory; admins aren't. */}
          {position !== "admin" && (
            <fieldset className="portal-form-section">
              <legend>Directory photo</legend>
              <div className="portal-form-grid">
                <Field label={initial.photoUrl ? "Replace photo (optional)" : "Photo (optional)"} hint="Shown with their name in the Directory and on the website’s About page. JPG, PNG or WebP; large photos are compressed automatically. A square photo works best." error={errors.photo}>
                  <PhotoInput name="photo" />
                </Field>
                {initial.photoUrl && (
                  <div className="portal-photo-current">
                    <Image src={initial.photoUrl} alt="" width={56} height={56} />
                    <label className="portal-check">
                      <input name="removePhoto" type="checkbox" />
                      <span><strong>Remove current photo</strong></span>
                    </label>
                  </div>
                )}
              </div>
            </fieldset>
          )}
        </>
      )}

      {askEmail && (
        <fieldset className="portal-form-section">
          <legend>Notification</legend>
          <label className="portal-check">
            <input type="checkbox" name="notifyEmail" defaultChecked />
            <span><strong>Notify via email</strong><small>Send an account-added email with a link to verify access. Their email is verified when they first sign in to the portal with their UST Google account.</small></span>
          </label>
        </fieldset>
      )}

      <FormFooter state={state} pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} danger={danger} />
    </form>
  );
}
