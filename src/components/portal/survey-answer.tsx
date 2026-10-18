"use client";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EditorFields } from "@/components/events/editor-fields";
import { EventConsentStatement, EventFormTracker } from "@/components/events/event-form-ui";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { scrollToElement } from "@/lib/scroll";
import { acknowledgementOf, fillTags, type EditorDefinition, type FormAnswers } from "@/lib/events/form-editor";
import { resolveFlow } from "@/lib/events/form-flow";
import { submitSurvey } from "@/lib/surveys/actions";
import { FormPreview } from "./form-preview";
import { toast } from "./toast";
import { SaveIcon } from "@/components/action-icons";
import { DraftNotice } from "@/components/draft-notice";
import { useFormDraft } from "@/components/use-form-draft";
import "./event-form-editor.css";
import "./surveys.css";
import { Busy } from "@/components/busy";

export function SurveyAnswer({ id, title, description = "", definition, updatedAt, preview = false, answered = false }: { id: string; title: string; description?: string; definition: EditorDefinition; updatedAt: string; preview?: boolean; answered?: boolean }) {
  const privacyId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [stepId, setStepId] = useState(definition.steps[0]?.id);
  const [submitted, setSubmitted] = useState(answered);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const flow = resolveFlow(definition, answers);
  const acknowledgement = acknowledgementOf(definition);
  const index = Math.max(0, flow.steps.findIndex(step => step.id === stepId));
  const current = flow.steps[index];
  const last = index === flow.steps.length - 1;
  const formRef = useRef<HTMLFormElement>(null);
  // Answers stay on this device until sent, through a reload or a dropped connection.
  const draft = useFormDraft({
    key: preview || answered ? null : `survey:${id}:${updatedAt}`,
    form: formRef,
    state: { stepId, answers },
    restore: (saved) => {
      setAnswers(saved.answers ?? {});
      if (saved.stepId) setStepId(saved.stepId);
    },
  });
  const go = (next: number) => {
    setSubmitted(false);
    setStepId(flow.steps[next]?.id);
    requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      if (headingRef.current) scrollToElement(headingRef.current);
    });
  };
  const showAcknowledgement = () => {
    setSubmitted(true);
    requestAnimationFrame(() => {
      if (headingRef.current) scrollToElement(headingRef.current);
    });
  };
  return <FormPreview><div className="portal-survey-form">
    {preview && <header className="portal-survey-form-banner"><span>Survey form</span><h2>{title}</h2>{description && <p>{description}</p>}</header>}
    <form ref={formRef} className="apply-form ev-form ev-steps-form ev-evaluation-form ev-rsvp-form ev-application-form portal-survey-answer" noValidate data-validation={preview ? "off" : undefined} aria-busy={pending} onSubmit={event => {
      event.preventDefault();
      if (pending || submitted) return;
      if (!last) { go(index + 1); return; }
      if (preview) { showAcknowledgement(); return; }
      startTransition(async () => {
        const result = await submitSurvey(id, answers, updatedAt);
        if (result.error) { toast(result.error, "error"); return; }
        draft.clear();
        showAcknowledgement();
        toast("Response recorded. Thank you for answering this survey.");
        router.refresh();
      });
    }}>
      <EventFormTracker steps={flow.steps} current={submitted ? flow.steps.length : index} acknowledgement={definition.steps.at(-1)?.title ?? "Acknowledgement"} label="Survey steps" preview={preview} busy={pending || (submitted && !preview)} onStep={go} onAcknowledgement={showAcknowledgement} />
      <div className="apply-body ev-form-body">
        {submitted ? <>
          <div className="apply-body-head"><span>Step {flow.steps.length + 1} of {flow.steps.length + 1}</span><h2 ref={headingRef} tabIndex={-1}>{acknowledgement?.title ?? "Response recorded"}</h2></div>
          <div className="portal-survey-acknowledgement"><CheckCircle2 size={24} aria-hidden="true" /><p>{fillTags(acknowledgement?.message ?? "Thank you for answering this survey.", { event: title, link: "" })}</p></div>
          {preview && <footer className="portal-settings-foot"><button type="button" className="ev-button is-ghost" onClick={() => go(Math.max(0, flow.steps.length - 1))}><ArrowLeft size={15} aria-hidden="true" />Back to form</button></footer>}
        </> : current ? <>
          <DraftNotice draft={draft} buttonClassName="ev-button is-ghost is-small" actionClassName="ev-button is-primary" />
          <div className="apply-body-head"><span>Step {index + 1} of {flow.steps.length + 1}</span><h2 ref={headingRef} tabIndex={-1}>{current.title}</h2>{current.description && <p>{current.description}</p>}</div>
          <fieldset disabled={pending} className="apply-group ev-group ev-rsvp-group ev-animated-fields" key={current.id}>
            <legend className="ev-sr-only">{current.title}</legend>
            {current.kind === "privacy" && <EventConsentStatement id={privacyId} />}
            <EditorFields fields={current.fields} visible={flow.visible} values={answers} portalPickers onChange={(key, value) => setAnswers(previous => ({ ...previous, [key]: value }))} />
          </fieldset>
          <footer className="portal-settings-foot"><div>{index > 0 && <button type="button" className="ev-button is-ghost" disabled={pending} onClick={() => go(index - 1)}><ArrowLeft size={15} aria-hidden="true" />Back</button>}</div><button type="submit" className="ev-button is-primary" disabled={pending}>{last ? <SaveIcon size={15} aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />}{pending ? <Busy>Submitting</Busy> : last ? preview ? "Preview submission" : "Submit response" : "Continue"}</button></footer>
        </> : <p className="portal-empty">Add a question to preview this survey.</p>}
      </div>
    </form>
  </div></FormPreview>;
}
