"use client";

import { useState } from "react";
import { acceptanceEmail, joinCommissionUrl, type OnboardingSettings } from "@/lib/applications/onboarding";
import { concernOf } from "@/lib/notifications/concern";
import { positionsForUnit } from "@/lib/applications/options";
import { LOGO_PATH } from "@/lib/email/template";
import { updateRecruitmentOnboarding } from "@/lib/portal/recruitment-actions";
import { Field, useHydrated, usePortalForm } from "./portal-form";
import { SlidingFilterButtons } from "./sliding-filters";
import { EmailPreview } from "./email-preview";
import { ViewOnly } from "./view-only";
import { DeleteButton } from "./delete-button";
import { InfoTip } from "./info-tip";
import "./recruitment-onboarding.css";

const tabs = [{ key: "settings", label: "Settings" }, { key: "preview", label: "Preview" }];
const editable = (settings: OnboardingSettings) => ({ ...settings, buttons: settings.buttons.map((button, index) => ({ ...button, id: `saved-${index}` })) });

export function RecruitmentOnboarding({ settings, unit, readOnly }: { settings: OnboardingSettings; unit: string; readOnly: boolean }) {
  const [tab, setTab] = useState("settings");
  const [draft, setDraft] = useState(() => editable(settings));
  const { pending, onSubmit, errors } = usePortalForm(updateRecruitmentOnboarding);
  const hydrated = useHydrated();
  const buttons = draft.buttons.map(({ title, url }) => ({ title, url }));
  const dirty = draft.messengerUrl !== settings.messengerUrl || JSON.stringify(buttons) !== JSON.stringify(settings.buttons);
  const position = positionsForUnit(unit)[0];
  const preview = acceptanceEmail({ email: "applicant@ust.edu.ph", firstName: "Juan", position: position?.label ?? "Commissioner", positionId: position?.id, division: "", referenceCode: "PREVIEW", concern: concernOf(unit ? "local" : "central", unit) }, { messengerUrl: draft.messengerUrl, buttons: buttons.filter(button => button.title.trim() && button.url.trim()) }, LOGO_PATH);
  const changeButton = (index: number, field: "title" | "url", value: string) => setDraft(current => ({ ...current, buttons: current.buttons.map((button, i) => i === index ? { ...button, [field]: value } : button) }));

  return <>
    <SlidingFilterButtons items={tabs} active={tab} label="Onboarding settings views" onChange={setTab} />
    <form className="portal-card is-flush" onSubmit={onSubmit} noValidate>
      <input type="hidden" name="unit" value={unit} />
      <input type="hidden" name="messengerUrl" value={draft.messengerUrl} />
      <input type="hidden" name="buttons" value={JSON.stringify(buttons)} />
      <div className="recruitment-onboarding-content" hidden={tab !== "settings"}>
        <div className="portal-field">
          <span className="portal-field-label">Join button<InfoTip>Always first in the email. It opens Request access with the applicant’s details filled in, and their request is approved as soon as they finish onboarding.</InfoTip></span>
          <a className="portal-button is-ghost" href={joinCommissionUrl()} target="_blank" rel="noopener noreferrer">Join the Commission</a>
        </div>
        <ViewOnly when={readOnly}>
          <fieldset className="recruitment-onboarding-fields" disabled={pending}>
            <Field label="Messenger group chat link" hint="Adds a ‘Join Messenger Group Chat’ button after Join the Commission. Leave it blank to omit it." error={errors.messengerUrl}>
              <input type="url" placeholder="https://m.me/j/…" maxLength={2000} value={draft.messengerUrl} onChange={event => setDraft({ ...draft, messengerUrl: event.target.value })} />
            </Field>
            {draft.buttons.map((button, index) => <section className="recruitment-onboarding-extra" key={button.id} aria-label={`Additional button ${index + 1}`}>
              <Field label="Button title" error={errors[`buttons.${index}.title`]}>
                <input type="text" maxLength={100} value={button.title} onChange={event => changeButton(index, "title", event.target.value)} />
              </Field>
              <Field label="Button content link" error={errors[`buttons.${index}.url`]}>
                <input type="url" maxLength={2000} placeholder="https://…" value={button.url} onChange={event => changeButton(index, "url", event.target.value)} />
              </Field>
              <DeleteButton label="Delete button" prompt="Remove this button?" confirmLabel="Delete button" action={async () => setDraft(current => ({ ...current, buttons: current.buttons.filter(item => item.id !== button.id) }))} />
            </section>)}
            {errors.buttons && <span className="portal-field-error">{errors.buttons}</span>}
            {!readOnly && <button type="button" className="portal-button is-ghost" disabled={draft.buttons.length >= 10} onClick={() => setDraft(current => ({ ...current, buttons: [...current.buttons, { id: crypto.randomUUID(), title: "", url: "" }] }))}>Add button</button>}
          </fieldset>
        </ViewOnly>
      </div>
      <div hidden={tab !== "preview"}>
        <EmailPreview html={preview.html} from="UST Central Comelec · comelec@ust.edu.ph" to={preview.to} subject={preview.subject} />
      </div>
      {!readOnly && <footer className="portal-settings-foot">
        <span className="portal-settings-dirty" aria-live="polite">{dirty ? "Unsaved changes" : "Saved"}</span>
        <div className="portal-form-actions">
          <button type="button" className="portal-button is-ghost" disabled={pending || !dirty} onClick={() => setDraft(editable(settings))}>Discard</button>
          <button type="submit" className="portal-button" disabled={pending || !dirty || !hydrated}>{pending ? "Saving…" : dirty ? "Save settings" : "Saved"}</button>
        </div>
      </footer>}
    </form>
  </>;
}
