"use client";

import { SaveIcon, ViewIcon, HideIcon } from "@/components/action-icons";
import { useActionState, useId, useState } from "react";
import { CheckCircle2, Clock3, LockKeyhole, CalendarClock, XCircle } from "lucide-react";
import { registrationStatuses, registrationStatusHints, type RegistrationStatus } from "@/lib/events/options";
import { rsvpFormPath, type RsvpSettings } from "@/lib/events/rsvp";
import type { EvaluationSettings } from "@/lib/events/evaluation";
import { saveEventDeployment, type EventDeploymentState } from "@/lib/portal/event-actions";
import { InfoTip, TitleWithInfo } from "./info-tip";
import { EventRegistrationLink } from "./event-registration-link";
import { EventCapacityFields, EventCapacityTracker } from "./event-capacity";
import { EventEvaluationTracker } from "./event-evaluation-tracker";
import type { EventResponseCounts } from "@/lib/events/response-counts";
import { SlidingSegments } from "./sliding-filters";
import { Dropdown } from "./dropdown";
import { ViewOnlyTag } from "./view-only";
import { useToast } from "./toast";

const statusIcons = { open: CheckCircle2, closed: LockKeyhole, waitlist: Clock3, cancelled: XCircle, rescheduled: CalendarClock };
const deploymentForms = [{ key: "registration", label: "Registration Form" }, { key: "rsvp", label: "RSVP Form" }, { key: "evaluation", label: "Evaluation Form" }] as const;
type DeploymentForm = typeof deploymentForms[number]["key"];
const statusOrder: RegistrationStatus[] = ["open", "waitlist", "closed", "rescheduled", "cancelled"];

export function EventDeployment({ eventId, baseUrl, published = true, registrationStatus, minimumRegistrants = 1, maximumRegistrants = null, registeredCount = 0, responseCounts = { rsvp: 0, evaluation: 0 }, requireGoogle = true, rsvp, evaluation, editable }: { eventId: string; baseUrl: string; published?: boolean; registrationStatus: RegistrationStatus; minimumRegistrants?: number; maximumRegistrants?: number | null; registeredCount?: number; responseCounts?: EventResponseCounts | null; requireGoogle?: boolean; rsvp: RsvpSettings | null; evaluation: EvaluationSettings; editable: boolean }) {
  const id = useId();
  const [activeForm, setActiveForm] = useState<DeploymentForm>("registration");
  const [saved, setSaved] = useState({ published, registrationStatus, minimumRegistrants: String(minimumRegistrants), maximumRegistrants: maximumRegistrants === null ? "" : String(maximumRegistrants), requireGoogle, rsvpEnabled: rsvp?.enabled ?? false, rsvpGoogle: rsvp?.require_google ?? false, evaluationEnabled: evaluation.enabled, evaluationGoogle: evaluation.requireGoogle ?? false, allowAnonymous: evaluation.allowAnonymous });
  const [draft, setDraft] = useState(saved);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const change = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const [state, action, pending] = useActionState<EventDeploymentState, FormData>(async (previous, form) => {
    const result = await saveEventDeployment(eventId, previous, form);
    if (result.success) { const next = { ...draft, registrationStatus: result.registrationStatus ?? draft.registrationStatus }; setSaved(next); setDraft(next); }
    return result;
  }, {});
  useToast(state.error, "error", state);
  useToast(state.success ? "Deployment settings saved." : null, "ok", state);
  const StatusIcon = statusIcons[draft.registrationStatus];
  const visibilityHint = draft.published !== saved.published
    ? draft.published ? "Will be visible on the website after saving." : "Will be hidden from the website after saving, including public form links."
    : draft.published ? "Visible on the website." : "Hidden from the website. Public form links are unavailable.";

  const settingsActions = editable ? <div className="portal-deployment-settings-actions"><span className="portal-settings-dirty">{dirty ? "Unsaved changes" : ""}</span><div className="portal-form-actions">{dirty && <button className="portal-button is-ghost" type="button" disabled={pending} onClick={() => setDraft(saved)}>Discard</button>}<button className="portal-button" type="submit" disabled={pending || !dirty}><SaveIcon size={15} aria-hidden="true" />{pending ? "Saving…" : dirty ? "Save Changes" : "Changes Saved"}</button></div></div> : null;

  return <form className="portal-form portal-deployment" action={action} noValidate>
    <section className="portal-card portal-deployment-overview">
      <div className="portal-deployment-column">
      <header className="portal-card-head"><TitleWithInfo as="h2" className="portal-card-title" info={visibilityHint}>Website visibility</TitleWithInfo>{!editable && <ViewOnlyTag />}</header>
      <fieldset disabled={!editable || pending}>
        <legend className="portal-visually-hidden">Website visibility</legend>
        <SlidingSegments active={draft.published} role="radiogroup" aria-label="Website visibility">
          {[true, false].map(visible => {
            const Icon = visible ? ViewIcon : HideIcon;
            return <label className={`portal-segment${draft.published === visible ? " is-selected" : ""}`} key={String(visible)}><input type="radio" name="publicationStatus" value={visible ? "published" : "unpublished"} checked={draft.published === visible} onChange={() => change("published", visible)} required /><Icon size={15} aria-hidden="true" />{visible ? "Published" : "Unpublished"}</label>;
          })}
        </SlidingSegments>
      </fieldset>
      {state.fieldErrors?.publicationStatus && <p className="portal-field-error">{state.fieldErrors.publicationStatus}</p>}
      </div>
      <div className="portal-deployment-column">
        <header className="portal-card-head"><TitleWithInfo as="h2" className="portal-card-title" info="Published events appear on the website. Unpublished events and their public form links are hidden; the event and its existing responses stay in the portal.">Deploy status</TitleWithInfo></header>
        <SlidingSegments active={activeForm} className="portal-deployment-forms" role="radiogroup" aria-label="Deploy status">
          {deploymentForms.map(item => <label className={`portal-segment${activeForm === item.key ? " is-selected" : ""}`} key={item.key}>
            <input type="radio" name="deploymentForm" value={item.key} checked={activeForm === item.key} onChange={() => setActiveForm(item.key)} />{item.label}
          </label>)}
        </SlidingSegments>
      </div>
    </section>
    <section className="portal-card" hidden={activeForm !== "registration"}>
      <header className="portal-card-head portal-deployment-settings-head"><TitleWithInfo as="h2" className="portal-deployment-settings-title" info="Registration status controls whether people can sign up. Website visibility is controlled separately above. Closing registration doesn’t unpublish the event.">Registration Form</TitleWithInfo>{activeForm === "registration" && settingsActions}</header>
      <EventRegistrationLink boxed label="Registration form" href={`${baseUrl}/events/${eventId}/register`} />
      <fieldset disabled={!editable || pending}>
        <legend className="portal-visually-hidden">Registration status</legend>
        <div className="portal-event-form-link portal-deployment-status-box" data-status={draft.registrationStatus}>
          <span className="portal-event-form-link-icon"><StatusIcon size={18} aria-hidden="true" /></span>
          <div className="portal-event-form-link-content">
            <span id={`${id}-status-label`}>Registration status</span>
            <p>{registrationStatusHints[draft.registrationStatus]}</p>
          </div>
          <Dropdown name="registrationStatus" value={draft.registrationStatus} onChange={value => change("registrationStatus", value as RegistrationStatus)} options={statusOrder.map(status => ({ value: status, label: registrationStatuses[status] }))} labelledBy={`${id}-status-label`} disabled={!editable || pending} invalid={!!state.fieldErrors?.registrationStatus} required />
        </div>
        <EventCapacityFields minimum={draft.minimumRegistrants} maximum={draft.maximumRegistrants} onMinimumChange={value => change("minimumRegistrants", value)} onMaximumChange={value => change("maximumRegistrants", value)} errors={state.fieldErrors} />
        <EventCapacityTracker registered={registeredCount} minimum={Number(draft.minimumRegistrants) || 1} maximum={draft.maximumRegistrants && Number(draft.maximumRegistrants) >= 1 ? Number(draft.maximumRegistrants) : null} />
        <input type="hidden" name="googleSetting" value="on" />
        <AuthenticationSetting id={`${id}-registration-google`} name="googleEnabled" checked={draft.requireGoogle} onChange={value => change("requireGoogle", value)} form="registration" />
        {state.fieldErrors?.registrationStatus && <p className="portal-field-error">{state.fieldErrors.registrationStatus}</p>}
      </fieldset>
    </section>
    <section className="portal-card" hidden={activeForm !== "rsvp"}>
      <header className="portal-card-head portal-deployment-settings-head"><h2 className="portal-deployment-settings-title">RSVP Form</h2>{activeForm === "rsvp" && settingsActions}</header>
      <EventRegistrationLink boxed label="RSVP form" href={`${baseUrl}${rsvpFormPath(eventId)}`} />
      <fieldset disabled={!editable || pending}>
      <legend className="portal-visually-hidden">RSVP form settings</legend>
      <FormAvailabilitySetting id={`${id}-rsvp-status`} name="rsvpEnabled" form="RSVP" enabled={draft.rsvpEnabled} onChange={value => change("rsvpEnabled", value)} disabled={!editable || pending} />
      <input type="hidden" name="rsvpGoogleSetting" value="on" />
      <AuthenticationSetting id={`${id}-rsvp-google`} name="rsvpGoogleEnabled" checked={draft.rsvpGoogle} onChange={value => change("rsvpGoogle", value)} form="RSVP" />
    </fieldset>{!rsvp && <p className="portal-muted">Save deployment settings to activate this form link.</p>}</section>
    <section className="portal-card" hidden={activeForm !== "evaluation"}>
      <header className="portal-card-head portal-deployment-settings-head"><h2 className="portal-deployment-settings-title">Evaluation Form</h2>{activeForm === "evaluation" && settingsActions}</header>
      <EventRegistrationLink boxed label="Evaluation form" href={`${baseUrl}/events/${eventId}/evaluate`} />
      <fieldset disabled={!editable || pending}>
      <legend className="portal-visually-hidden">Evaluation form settings</legend>
      <FormAvailabilitySetting id={`${id}-evaluation-status`} name="evaluationEnabled" form="Evaluation" enabled={draft.evaluationEnabled} onChange={value => change("evaluationEnabled", value)} disabled={!editable || pending} />
      <EventEvaluationTracker registered={registeredCount} counts={responseCounts} />
      <div className="portal-deployment-evaluation-options">
      <div className="portal-deployment-anonymous"><label className="portal-check"><input type="checkbox" name="allowAnonymous" checked={draft.allowAnonymous} onChange={event => change("allowAnonymous", event.target.checked)} /><span><strong>Allow anonymous feedback</strong></span></label><InfoTip>Works with required student authentication. Anonymous feedback saves no email, name, registration link or profile answers. Google verification only checks eligibility.</InfoTip></div>
      <input type="hidden" name="evaluationGoogleSetting" value="on" />
      <AuthenticationSetting id={`${id}-evaluation-google`} name="evaluationGoogleEnabled" checked={draft.evaluationGoogle} onChange={value => change("evaluationGoogle", value)} form="evaluation" />
      </div>
    </fieldset></section>

  </form>;
}

function FormAvailabilitySetting({ id, name, form, enabled, onChange, disabled }: { id: string; name: string; form: "RSVP" | "Evaluation"; enabled: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  const Icon = enabled ? CheckCircle2 : LockKeyhole;
  return <div className="portal-event-form-link portal-deployment-status-box" data-status={enabled ? "open" : "closed"}>
    <span className="portal-event-form-link-icon"><Icon size={18} aria-hidden="true" /></span>
    <div className="portal-event-form-link-content">
      <span id={id}>{form} status</span>
      <p>{enabled ? form === "RSVP" ? "Accept RSVP responses from invited collaborators." : "Accept evaluation responses." : `Pause new ${form === "RSVP" ? "RSVP" : "evaluation"} responses. Existing responses stay in the portal.`}</p>
    </div>
    <Dropdown name={name} value={enabled ? "on" : "off"} onChange={value => onChange(value === "on")} options={[{ value: "on", label: "Open" }, { value: "off", label: "Closed" }]} labelledBy={id} disabled={disabled} required />
  </div>;
}

function AuthenticationSetting({ id, name, checked, onChange, form }: { id: string; name: string; checked: boolean; onChange: (value: boolean) => void; form: string }) {
  return <div className="portal-deployment-auth"><label className="portal-check" htmlFor={id}><input id={id} type="checkbox" name={name} checked={checked} onChange={event => onChange(event.target.checked)} /><strong>Require student authentication via Google Sign-In</strong></label><InfoTip>UST students, faculty and staff verify their @ust.edu.ph account before their {form} response is taken. External respondents can enter their email. Untick it to let everyone type their email.{form === "evaluation" && " Anonymous feedback remains anonymous; verification is not saved with the response."}</InfoTip></div>;
}
