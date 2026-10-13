"use client";
import { SaveIcon as ActionSaveIcon } from "@/components/action-icons";
import { useActionState } from "react";
import { registrationStatuses, registrationStatusHints, type RegistrationStatus } from "@/lib/events/options";
import { rsvpFormPath, type RsvpSettings } from "@/lib/events/rsvp";
import type { EvaluationSettings } from "@/lib/events/evaluation";
import { saveEventDeployment, type EventDeploymentState } from "@/lib/portal/event-actions";
import { InfoTip } from "./info-tip";
import { EventRegistrationLink } from "./event-registration-link";
import { useToast } from "./toast";

export function EventDeployment({ eventId, baseUrl, registrationStatus, requireGoogle = true, rsvp, evaluation, editable }: { eventId: string; baseUrl: string; registrationStatus: RegistrationStatus; requireGoogle?: boolean; rsvp: RsvpSettings | null; evaluation: EvaluationSettings; editable: boolean }) {
  const [state, action, pending] = useActionState<EventDeploymentState, FormData>(saveEventDeployment.bind(null, eventId), {});
  useToast(state.error, "error", state);
  useToast(state.success ? "Deployment settings saved." : null, "ok", state);
  return <form className="portal-form portal-deployment" action={action}>
    <section className="portal-card portal-form-section"><fieldset disabled={!editable || pending}>
      <legend>Registration Status</legend>
      <div className="portal-options">{(Object.keys(registrationStatuses) as RegistrationStatus[]).map(status => <label className="portal-check" key={status}><input type="radio" name="registrationStatus" value={status} defaultChecked={registrationStatus === status} /><span><strong>{registrationStatuses[status]}</strong><small>{registrationStatusHints[status]}</small></span></label>)}</div>
      <input type="hidden" name="googleSetting" value="on" />
      <AuthenticationSetting name="googleEnabled" checked={requireGoogle} form="registration" />
      {state.fieldErrors?.registrationStatus && <p className="portal-field-error">{state.fieldErrors.registrationStatus}</p>}
      </fieldset>
      <EventRegistrationLink label="Registration form" href={`${baseUrl}/events/${eventId}/register`} />
    </section>
    <section className="portal-card portal-form-section"><fieldset disabled={!editable || pending}>
      <legend>RSVP Form Settings</legend>
      <label className="portal-check"><input type="checkbox" name="rsvpEnabled" defaultChecked={rsvp?.enabled ?? false} /><span><strong>Accept RSVP responses</strong><small>Open the form for invited collaborators.</small></span></label>
      <input type="hidden" name="rsvpGoogleSetting" value="on" />
      <AuthenticationSetting name="rsvpGoogleEnabled" checked={rsvp?.require_google ?? false} form="RSVP" />
      </fieldset>
      <EventRegistrationLink label="RSVP form" href={`${baseUrl}${rsvpFormPath(eventId)}`} />
      {!rsvp && <p className="portal-muted">Save deployment settings to activate this form link.</p>}
    </section>
    <section className="portal-card portal-form-section"><fieldset disabled={!editable || pending}>
      <legend>Evaluation Form Settings</legend>
      <label className="portal-check"><input type="checkbox" name="evaluationEnabled" defaultChecked={evaluation.enabled} /><span><strong>Accept evaluation responses</strong></span></label>
      <label className="portal-check"><input type="checkbox" name="allowAnonymous" defaultChecked={evaluation.allowAnonymous} /><span><strong>Allow anonymous feedback</strong></span></label>
      <input type="hidden" name="evaluationGoogleSetting" value="on" />
      <AuthenticationSetting name="evaluationGoogleEnabled" checked={evaluation.requireGoogle ?? false} form="evaluation" />
      </fieldset>
      <EventRegistrationLink label="Evaluation form" href={`${baseUrl}/events/${eventId}/evaluate`} />
    </section>
    {editable ? <button className="portal-button" disabled={pending}><ActionSaveIcon size={15} aria-hidden="true" />{pending ? "Saving…" : "Save deployment settings"}</button> : <p className="portal-muted">Read-only access</p>}
  </form>;
}

function AuthenticationSetting({ name, checked, form }: { name: string; checked: boolean; form: string }) {
  return <div className="portal-deployment-auth"><label className="portal-check" htmlFor={name}><input id={name} type="checkbox" name={name} defaultChecked={checked} /><strong>Require student authentication via Google Sign-In</strong></label><InfoTip>UST students, faculty and staff verify their @ust.edu.ph account before their {form} response is taken. External respondents can enter their email. Untick it to let everyone type their email.{form === "evaluation" && " Anonymous feedback remains anonymous; verification is not saved with the response."}</InfoTip></div>;
}
