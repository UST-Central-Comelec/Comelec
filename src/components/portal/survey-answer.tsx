"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EditorFields } from "@/components/events/editor-fields";
import { acknowledgementOf, fillTags, type EditorDefinition, type FormAnswers } from "@/lib/events/form-editor";
import { resolveFlow } from "@/lib/events/form-flow";
import { submitSurvey } from "@/lib/surveys/actions";
import { FormPreview } from "./form-preview";
import { toast } from "./toast";
import { SaveIcon } from "@/components/action-icons";
import "./event-form-editor.css";
import "./surveys.css";

export function SurveyAnswer({ id, title, definition, updatedAt, preview = false, answered = false }: { id: string; title: string; definition: EditorDefinition; updatedAt: string; preview?: boolean; answered?: boolean }) {
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [submitted, setSubmitted] = useState(answered);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const flow = resolveFlow(definition, answers);
  const acknowledgement = acknowledgementOf(definition);
  if (submitted) return <div className="portal-empty"><h2>{acknowledgement?.title ?? "Response recorded"}</h2><p>{fillTags(acknowledgement?.message ?? "Thank you for answering this survey.", { event: title, link: "" })}</p></div>;
  return <FormPreview><form className="ev-rsvp-review-form portal-survey-answer" data-validation={preview ? "off" : undefined} onSubmit={event => {
    event.preventDefault();
    if (preview) { toast("This is a preview. No response was submitted."); return; }
    startTransition(async () => {
      const result = await submitSurvey(id, answers, updatedAt);
      if (result.error) { toast(result.error, "error"); return; }
      setSubmitted(true);
      toast("Response recorded. Thank you for answering this survey.");
      router.refresh();
    });
  }}><fieldset disabled={pending} className="portal-survey-fields">{flow.steps.map(step => <section className="ev-rsvp-group" key={step.id}><h2>{step.title}</h2>{step.description && <p className="portal-muted">{step.description}</p>}<EditorFields fields={step.fields} visible={flow.visible} values={answers} portalPickers onChange={(key, value) => setAnswers(previous => ({ ...previous, [key]: value }))} /></section>)}</fieldset><div className="portal-form-actions"><button type="submit" className="portal-button" disabled={pending}><SaveIcon size={15} aria-hidden="true" />{pending ? "Submitting…" : preview ? "Preview submission" : "Submit response"}</button></div></form></FormPreview>;
}
