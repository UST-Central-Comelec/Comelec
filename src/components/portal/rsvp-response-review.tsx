"use client";
import { DeleteIcon as ActionDeleteIcon, SaveIcon as ActionSaveIcon } from "@/components/action-icons";
import { useRef, useState, useTransition } from "react";
import { Package } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { EditorFields } from "@/components/events/editor-fields";
import { committeeAssignments, logisticalResources, formFacts, rsvpRespondent, type RsvpResponse } from "@/lib/events/rsvp";
import { isBlock, validateEditorAnswers, type FormAnswers } from "@/lib/events/form-editor";
import { resolveFlow } from "@/lib/events/form-flow";
import { rsvpProfileGroups, rsvpReviewSteps, rsvpReviewModel, rsvpLogisticsFieldIds, rsvpLogisticalRequests } from "@/lib/events/rsvp-review";
import type { RsvpResponseResult } from "@/lib/events/rsvp-response-actions";
import { EvaluationResponseDetails } from "./event-evaluation-editor";
import type { EvaluationQuestion, EvaluationResponse } from "@/lib/events/evaluation";
import { LogisticalRequests } from "./logistical-requests";
import { requestDecisionStatus, type RequestKind, type RequestStatus } from "@/lib/events/options";
import { FormPreview } from "./form-preview";
import { CopyableReviewFact, ReviewModalDetailsGroup, ReviewModalFooter, ReviewModalHeader, ReviewModalToolbar } from "./review-modal-ui";
import { ViewOnly, ViewOnlyTag } from "./view-only";
import { toast } from "./toast";
import { ReviewActionIcon } from "./review-action-icon";
import "./event-form-editor.css";

export type RsvpReviewActions = {
  logistics: (id: string, stamp: string, decisions: Partial<Record<RequestKind, boolean>>) => Promise<RsvpResponseResult>;
  update: (id: string, stamp: string, values: FormAnswers) => Promise<RsvpResponseResult>;
  remove: (id: string, stamp: string) => Promise<RsvpResponseResult>;
  resend: (id: string) => Promise<RsvpResponseResult>;
};
export function RsvpResponseReview({ response, titleId, actions, onRemoved, onBusy, back, children, editRequestActions, requestBusy = false, evaluation = null, evaluationQuestions }: { response: RsvpResponse; titleId: string; actions?: RsvpReviewActions; onRemoved: () => void; onBusy: (busy: boolean) => void; back?: () => void; children?: React.ReactNode; editRequestActions?: React.ReactNode; requestBusy?: boolean; evaluation?: EvaluationResponse | null; evaluationQuestions?: EvaluationQuestion[] }) {
  const [saved, setSaved] = useState(response);
  const initial = rsvpReviewModel(saved.answers);
  const [draft, setDraft] = useState<FormAnswers>(initial.values);
  const [picks, setPicks] = useState<Partial<Record<RequestKind, boolean>>>({});
  const [editing, setEditing] = useState(false);
  const [stepId, setStepId] = useState("");
  const [confirmation, setConfirmation] = useState<"update" | "remove" | "logistics">("update");
  const [conflict, setConflict] = useState<RsvpResponse>();
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState<"update" | "remove" | "resend" | "logistics">();
  const working = useRef(false);
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const values = editing ? draft : initial.values;
  const flow = resolveFlow(initial.definition, values);
  const steps = rsvpReviewSteps(flow.steps);
  const evaluating = stepId === "evaluation_response";
  const current = evaluating ? undefined : steps.find(step => step.id === stepId) ?? steps[0];
  const tabs = steps.map(step => ({ key: step.id, label: step.title }));
  const logisticsIndex = steps.findIndex(step => step.id === "rsvp_logistics" || step.id === "logistics" || step.fields.some(field => field.id === "rsvp_logistics" || field.id === "logisticalNeeds.requests"));
  tabs.splice(logisticsIndex < 0 ? tabs.length : logisticsIndex + 1, 0, { key: "evaluation_response", label: "Evaluation Response" });
  const person = rsvpRespondent(saved.answers);
  const fields = current?.fields.filter(field => flow.visible.has(field.id) && !isBlock(field.kind)) ?? [];
  const hasLogistics = fields.some(field => field.id === "rsvp_logistics" || field.id === "logisticalNeeds.requests");
  const resourceOther = fields.find(field => (field.id === "rsvp_resource_other" || field.id === "resourceOther") && fields.some(choice => (choice.id === "rsvp_resources" || choice.id === "resources") && Array.isArray(values[choice.id]) && (values[choice.id] as string[]).includes("Other")));
  const ordinaryFields = fields.filter(field => !Array.isArray(values[field.id]) && field !== resourceOther && !(hasLogistics && rsvpLogisticsFieldIds.has(field.id)) && field.kind !== "checkbox");
  const profileView = current?.title === "Profile & Attendance";
  const detailGroups = profileView ? rsvpProfileGroups(ordinaryFields) : current && ordinaryFields.length ? [{ title: current.title, number: String(steps.indexOf(current) + 1).padStart(2, "0"), fields: ordinaryFields }] : [];
  const selections = fields.filter(field => (Array.isArray(values[field.id]) || field.kind === "checkbox") && !(hasLogistics && rsvpLogisticsFieldIds.has(field.id)));
  const requests = rsvpLogisticalRequests(initial.values).map(request => ({ ...request, status: saved.logistics_decisions?.[request.kind] ?? "pending" as RequestStatus }));
  const decisionChanges = requests.filter(request => picks[request.kind] !== undefined && requestDecisionStatus(request.status, picks[request.kind]!) !== request.status);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial.values);

  function ask(kind: "update" | "remove" | "logistics") {
    setConfirmation(kind);
    confirmDialog.current?.showModal();
  }
  function run(kind: "update" | "remove" | "logistics" | "resend") {
    if (!actions || working.current || requestBusy) return;
    working.current = true;
    setOperation(kind);
    onBusy(true);
    startTransition(async () => {
      try {
        const result = kind === "logistics" ? await actions.logistics(saved.id, saved.updated_at ?? "", Object.fromEntries(decisionChanges.map(request => [request.kind, picks[request.kind]!])) ) : kind === "update" ? await actions.update(saved.id, saved.updated_at ?? "", draft) : kind === "remove" ? await actions.remove(saved.id, saved.updated_at ?? "") : await actions.resend(saved.id);
        if (result.error) {
          if (result.conflict) { setConflict(result.conflict); confirmDialog.current?.close(); }
          toast(result.error, "error");
          return;
        }
        if (result.saved) { setSaved(result.saved); setDraft(rsvpReviewModel(result.saved.answers).values); setEditing(false); setPicks({}); }
        confirmDialog.current?.close();
        toast(result.message ?? "RSVP updated.", result.sent === false ? "warn" : "ok");
        if (result.removed) onRemoved();
      } catch (error) {
        unstable_rethrow(error);
        toast(kind === "remove" ? "Couldn’t remove the RSVP. Try again." : kind === "resend" ? "Couldn’t resend the acknowledgement. Try again." : "Couldn’t update the RSVP. Try again.", "error");
      } finally { working.current = false; setOperation(undefined); onBusy(false); }
    });
  }

  return <>
    <ReviewModalHeader titleId={titleId} name={person.name || "RSVP response"} reference={saved.reference_code ?? "—"} date={new Date(saved.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} />
    <ReviewModalToolbar label="RSVP response steps" active={evaluating ? "evaluation_response" : current?.id ?? ""} items={tabs} onChange={id => { setStepId(id); body.current?.scrollTo({ top: 0 }); }} />
    <div ref={body} className="portal-registrant-receipt-body">
      {back && <button type="button" className="portal-button is-small is-ghost" disabled={pending || editing} onClick={back}>Back to registration</button>}
      {!evaluating && children}
      {conflict && <section className="portal-response-edit-request"><p>Another officer changed this RSVP. Load their response to continue.</p><button type="button" className="portal-button is-small is-ghost" onClick={() => { setSaved(conflict); setDraft(rsvpReviewModel(conflict.answers).values); setConflict(undefined); setPicks({}); setEditing(false); toast("Latest RSVP loaded."); }}>Load latest response</button></section>}
      {evaluating ? <EvaluationResponseDetails response={evaluation} questions={evaluationQuestions} /> : <ViewOnly when={!actions}>
        {current && (editing ? <FormPreview><form ref={form} className="ev-rsvp-form ev-rsvp-review-form" noValidate onSubmit={event => {
          event.preventDefault();
          const issue = validateEditorAnswers(initial.definition, draft);
          if (issue) { toast(issue, "error"); const step = steps.find(step => step.fields.some(field => issue.includes(field.label))); if (step) setStepId(step.id); return; }
          ask("update");
        }}><fieldset className="apply-group ev-group ev-rsvp-group" disabled={pending}>
          <legend className="ev-sr-only">{current.title}</legend>
          <EditorFields fields={current.fields} values={draft} visible={flow.visible} onChange={(id, value) => setDraft(values => ({ ...values, [id]: value }))} portalPickers columns />
        </fieldset><div className="portal-settings-foot"><span className="portal-muted">{dirty ? "Unsaved changes" : "No changes"}</span><button type="button" className="portal-button is-small is-ghost" disabled={pending} onClick={() => { setDraft(initial.values); setEditing(false); setPicks({}); }}>Discard changes</button></div></form></FormPreview> : <div className="portal-registrant-groups">
          {detailGroups.map(group => <ReviewModalDetailsGroup key={group.number} title={group.title} number={group.number}>
            {group.fields.map(field => {
              const answer = formFacts({ steps: [{ ...current, fields: [field] }] }, values)[0]?.[1] || "Not provided";
              return profileView ? <CopyableReviewFact key={field.id} label={field.label}>{answer}</CopyableReviewFact> : <div key={field.id}><dt>{field.label}</dt><dd>{answer}</dd></div>;
            })}
          </ReviewModalDetailsGroup>)}
          {selections.map(field => {
            const selected = values[field.id];
            const answers = Array.isArray(selected) ? selected : [];
            const committees = field.id === "rsvp_committees" || field.id === "committees";
            const resources = field.id === "rsvp_resources" || field.id === "resources";
            return <section key={field.id} className={`portal-rsvp-selections${committees ? " is-committees" : ""}${resources ? " is-resources" : ""}`}>
              <header className="portal-rsvp-selections-head"><h3>{field.label}</h3><span>{answers.length} selected</span></header>
              {answers.length ? <ul>{answers.map((answer, index) => {
                const committee = committees ? committeeAssignments.find(item => answer === item.label || answer === `${item.label} (${item.phase})`) : undefined;
                const resource = resources ? logisticalResources.find(item => item.label === answer) : undefined;
                const optionIndex = field.options.indexOf(answer);
                const description = field.notes?.[optionIndex] ?? committee?.description ?? resource?.description;
                return <li key={`${index}:${answer}`} className={`portal-rsvp-selection${resource?.id === "none" ? " is-empty" : ""}`}>
                  {field.ranked ? <span className="portal-rsvp-selection-marker" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span> : resources ? <span className="portal-rsvp-selection-marker" aria-hidden="true"><Package size={18} /></span> : null}
                  <div className="portal-rsvp-selection-content">
                    {field.ranked && <span className="portal-rsvp-selection-rank">Preference {index + 1}</span>}
                    <strong>{committee?.label ?? answer}</strong>
                    {committee && <span className="portal-rsvp-selection-phase">{committee.phase}</span>}
                    {description && <p>{description}</p>}
                    {answer === "Other" && resourceOther && resources && <p className="portal-rsvp-selection-detail">{String(values[resourceOther.id] || "Not provided")}</p>}
                  </div>
                </li>;
              })}</ul> : <p className="portal-muted">None selected</p>}
            </section>;
          })}
          {hasLogistics && <div className="portal-registrant-logistics"><LogisticalRequests requests={requests} picks={picks} pending={pending || !!conflict} onPick={actions?.logistics ? (kind, approved) => setPicks(current => ({ ...current, [kind]: approved })) : undefined} />
            {decisionChanges.length > 0 && <div className="portal-settings-foot"><span className="portal-muted">Unsaved changes</span><button type="button" className="portal-button is-small is-ghost" disabled={pending} onClick={() => setPicks({})}>Discard changes</button></div>}</div>}
        </div>)}
      </ViewOnly>}
      {!evaluating && !current && <p className="portal-muted">No response steps to display.</p>}
    </div>
    {!evaluating && <ReviewModalFooter leading={actions && <button type="button" className="portal-button is-danger-ghost portal-destructive-button" disabled={pending || requestBusy || !!conflict} onClick={() => ask("remove")}><ReviewActionIcon kind="remove" disabled={pending || requestBusy || !!conflict} />Remove</button>}>{actions ? editRequestActions ?? <>
      <button type="button" className="portal-button is-ghost" disabled={pending || requestBusy || editing || !!conflict} onClick={() => run("resend")}><ReviewActionIcon kind="resend" disabled={pending || requestBusy || editing || !!conflict} />{pending && operation === "resend" ? "Sending…" : "Resend"}</button>
      <button type="button" className="portal-button" disabled={pending || requestBusy || !!conflict || (editing && !dirty)} onClick={() => { if (decisionChanges.length) ask("logistics"); else if (editing) form.current?.requestSubmit(); else { setDraft(initial.values); setEditing(true); } }}><ReviewActionIcon kind="update" disabled={pending || requestBusy || !!conflict || (editing && !dirty)} />{pending && (operation === "update" || operation === "logistics") ? "Updating…" : "Update"}</button>
    </> : <ViewOnlyTag />}</ReviewModalFooter>}
    <dialog ref={confirmDialog} className="portal-registrant-confirmation" aria-label={confirmation === "remove" ? "Remove RSVP registration" : confirmation === "logistics" ? "Update RSVP logistical decisions" : "Update RSVP response"} onClick={event => { if (event.target === event.currentTarget && !pending) confirmDialog.current?.close(); }} onCancel={event => { if (pending) event.preventDefault(); }}>
      <h2>{confirmation === "remove" ? "Remove RSVP registration?" : confirmation === "logistics" ? "Update logistical requests?" : "Update RSVP response?"}</h2>
      <p>{confirmation === "remove" ? <>Permanently remove <strong>{person.name}</strong>’s collaborator RSVP and its edit requests?</> : confirmation === "logistics" ? <>Save {decisionChanges.length} logistical decision{decisionChanges.length === 1 ? "" : "s"} for <strong>{person.name}</strong> and email them the changes?</> : <>Save the updated answers for <strong>{person.name}</strong> and send an acknowledgement to their email?</>}</p>
      <div className="portal-registrant-confirmation-actions"><button type="button" className="portal-button is-ghost" autoFocus disabled={pending} onClick={() => confirmDialog.current?.close()}>Cancel</button><button type="button" className={`portal-button ${confirmation === "remove" ? "is-danger" : ""}`} disabled={pending} onClick={() => run(confirmation)}>{confirmation === "remove" ? <ActionDeleteIcon size={15} /> : <ActionSaveIcon size={15} />}{pending ? confirmation === "remove" ? "Removing…" : "Updating…" : confirmation === "remove" ? "Remove Registration" : "Update & Send Email"}</button></div>
    </dialog>
  </>;
}
