"use client";

import { useMemo, useSyncExternalStore } from "react";
import { EventRegistration } from "@/components/events/registration-form";
import { emptyRegistration } from "@/lib/events/schema";
import { allowedAffiliations } from "@/lib/events/options";
import { RsvpForm } from "@/components/events/rsvp-form";
import { EvaluationForm } from "@/components/events/evaluation-form";
import { SurveyAnswer } from "@/components/portal/survey-answer";
import { formViewKey, readFormView } from "@/lib/forms/view-mode";
import "@/app/(site)/events/events.css";
import "@/components/events/rsvp.css";
import { Busy } from "@/components/busy";

const subscribe = () => () => {};
const serverSnapshot = () => undefined;

/** Standalone respondent view. All three form components bypass submission in preview. */
export function FormViewMode({ token }: { token: string }) {
  const raw = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(formViewKey(token)); } catch { return null; }
  }, serverSnapshot);
  const draft = useMemo(() => readFormView(raw ?? null), [raw]);
  if (raw === undefined) return <main className="ev ev-application-page" aria-busy="true"><div className="ev-notice"><p><Busy>Opening View Mode</Busy></p></div></main>;
  if (!draft) return <main className="ev ev-application-page"><header className="apply-top"><div className="apply-top-inner"><div className="apply-top-title"><h1>View Mode</h1></div></div></header><div className="ev-notice"><h2>Open the form again.</h2><p>This view has expired or is unavailable. Return to the editor and choose View Mode.</p></div></main>;
  const title = draft.kind === "registration" ? "Event registration" : draft.kind === "rsvp" ? "Collaborator RSVP" : draft.kind === "evaluation" ? "Event evaluation" : draft.name;
  return <main className="ev ev-evaluation-page ev-rsvp-page ev-application-page">
    <header className="apply-top"><div className="apply-top-inner"><div className="apply-top-title"><h1>{title}</h1><p className="ev-rsvp-event">{draft.kind === "survey" ? draft.description : draft.name}</p></div></div></header>
    {draft.kind === "registration" ? <EventRegistration preview action={async () => undefined} event={{ id: draft.eventId, name: draft.name }} mode="register" form={{ initial: emptyRegistration(), verifiedEmail: null, requireGoogle: false, allowed: allowedAffiliations(), fromWaitlist: false }} />
      : draft.kind === "rsvp" ? <RsvpForm preview eventId={draft.eventId} eventName={draft.name} token="" definition={draft.definition} registrationUrl={`/events/${draft.eventId}/register`} />
      : draft.kind === "evaluation" ? <EvaluationForm preview eventId={draft.eventId} eventName={draft.name} settings={{ ...draft.settings, enabled: true }} />
      : <SurveyAnswer preview id="preview" title={draft.name} description={draft.description} definition={draft.definition} updatedAt="" />}
  </main>;
}
