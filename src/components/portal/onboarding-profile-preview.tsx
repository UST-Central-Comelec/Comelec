"use client";

import { Combobox } from "@/components/combobox";
import { colleges } from "@/lib/applications/options";
import { accountPositions, affiliations, commissionerPositions } from "@/lib/data/types";
import { Dropdown, optionsOf } from "./dropdown";
import { Field } from "./portal-form";
import { ViewOnly } from "./view-only";
import "./onboarding.css";

const keepLocked = () => {};

/** The built-in profile's fields, without collecting or changing any requester details. */
export function OnboardingProfilePreview() {
  return <section className="portal-card is-flush" aria-label="Locked profile preview">
    <div className="onboarding-preview">
      <ViewOnly when>
        <fieldset className="portal-form-section">
          <legend>Name</legend>
          <div className="portal-form-grid portal-request-name">
            <Field label="Last name"><input name="lastName" placeholder="Last name" readOnly /></Field>
            <Field label="First name"><input name="firstName" placeholder="First name" readOnly /></Field>
            <Field label="Middle name"><input name="middleName" placeholder="Middle name" readOnly /></Field>
          </div>
        </fieldset>
        <fieldset className="portal-form-section">
          <legend>Contact and student details</legend>
          <div className="portal-form-grid">
            <Field label="UST email" hint="Filled in from the requester’s verified UST Google account." wide><input name="email" type="email" placeholder="Verified UST email" readOnly /></Field>
            <Field label="Student number"><input name="studentNumber" inputMode="numeric" maxLength={10} pattern="[0-9]{10}" placeholder="2023123456" readOnly /></Field>
            <Field label="Mobile number (optional)"><input name="contactNumber" type="tel" inputMode="numeric" maxLength={11} pattern="09[0-9]{9}" placeholder="09171234567" readOnly /></Field>
            <Field label="Facebook link (optional)" wide><input name="facebookUrl" type="url" placeholder="Facebook profile link" readOnly /></Field>
          </div>
        </fieldset>
        <fieldset className="portal-form-section">
          <legend>Academic details</legend>
          <div className="portal-form-grid">
            <Field label="College or faculty" wide><Combobox name="college" options={colleges} value="" onChange={keepLocked} placeholder="Type or pick your college" disabled /></Field>
            <Field label="Program"><Combobox name="program" options={[]} value="" onChange={keepLocked} placeholder="Pick a college first" disabled /></Field>
            <Field label="Year level"><Combobox name="yearLevel" options={[]} value="" onChange={keepLocked} placeholder="Select" disabled pickOnly /></Field>
          </div>
        </fieldset>
        <fieldset className="portal-form-section">
          <legend>In the commission</legend>
          <div className="portal-form-grid">
            <Field label="Serves in"><Dropdown name="affiliation" options={optionsOf(affiliations)} value="" disabled /></Field>
            <Field label="Position"><Dropdown name="position" options={commissionerPositions.map(value => ({ value, label: accountPositions[value] }))} value="" disabled /></Field>
            <Field label="Role" wide><Dropdown name="role" options={[]} value="" disabled /></Field>
          </div>
        </fieldset>
      </ViewOnly>
    </div>
  </section>;
}
