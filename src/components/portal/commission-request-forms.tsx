"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AddIcon, SaveIcon } from "@/components/action-icons";
import { Busy } from "@/components/busy";
import { DraftNotice } from "@/components/draft-notice";
import { useFormDraft } from "@/components/use-form-draft";
import { createCommissionRequest, saveCommissionRequestType, answerCommissionRequestAction, type CommissionRequestState } from "@/lib/portal/commission-request-actions";
import type { CommissionRequest, CommissionRequestType } from "@/lib/portal/commission-requests";
import { Field, useHydrated } from "./portal-form";
import { Dropdown } from "./dropdown";
import { DatePicker } from "./date-picker";
import { TimePicker } from "./time-picker";
import { useToast } from "./toast";

function useRequestAction(action: (state: CommissionRequestState, form: FormData) => Promise<CommissionRequestState>, onSuccess?: () => void) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [state, dispatch, pending] = useActionState(async (previous: CommissionRequestState, form: FormData) => {
    const result = await action(previous, form);
    if (result.sent) { onSuccess?.(); router.refresh(); }
    return result;
  }, {});
  useToast(state.error, "error", state);
  useToast(state.sent ? state.message : null, "ok", state);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(() => dispatch(data)); };
  return { state, pending: pending || !hydrated, onSubmit };
}

export function CreateCommissionRequest({ types, units, email, initialSubmission }: { types: CommissionRequestType[]; units: readonly string[]; email: string; initialSubmission: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ type: "", recipient: "", mode: "in-person", date: "", start: "", end: "", submission: initialSubmission });
  const draft = useFormDraft({ key: `commission-request:${email}`, form, state: values, restore: setValues });
  const { state, pending, onSubmit } = useRequestAction(createCommissionRequest, () => {
    draft.clear(); form.current?.reset();
    setValues({ type: "", recipient: "", mode: "in-person", date: "", start: "", end: "", submission: crypto.randomUUID() });
  });
  const update = (key: keyof typeof values) => (value: string) => setValues(current => ({ ...current, [key]: value }));
  const errors = state.fieldErrors ?? {};
  return <form ref={form} onSubmit={onSubmit}>
    <DraftNotice draft={draft} buttonClassName="portal-button is-small is-ghost" actionClassName="portal-button" />
    <input type="hidden" name="submission" value={values.submission} />
    <fieldset disabled={pending} className="portal-card cr-form">
      <div className="cr-fields">
        <Field label="Request type" hint={types.find(type => type.id === values.type)?.description || "Types are managed under Requests → Settings."} error={errors.type}><Dropdown name="type" value={values.type} onChange={update("type")} required label="Request type" options={types.filter(type => type.enabled).map(type => ({ value: type.id, label: type.name }))} /></Field>
        <Field label="Send to" error={errors.recipient}><Dropdown name="recipient" value={values.recipient} onChange={update("recipient")} required label="Send to" options={[{ value: "all", label: "All Local units" }, ...units.map(unit => ({ value: unit, label: unit }))]} /></Field>
        <Field label="Subject" wide error={errors.subject}><input name="subject" required maxLength={200} /></Field>
        <Field label="Request details" wide error={errors.details}><textarea name="details" required maxLength={4000} rows={5} /></Field>
        <Field label="Date" error={errors.date}><DatePicker name="date" value={values.date} onChange={update("date")} required label="Date" /></Field>
        <Field label="Meeting mode" error={errors.mode}><Dropdown name="mode" value={values.mode} onChange={update("mode")} required label="Meeting mode" options={[{ value: "in-person", label: "In person" }, { value: "online", label: "Online" }]} /></Field>
        <Field label="Start time" error={errors.start}><TimePicker name="start" value={values.start} onChange={update("start")} label="Start time" /></Field>
        <Field label="End time" error={errors.end}><TimePicker name="end" value={values.end} onChange={update("end")} label="End time" /></Field>
        <Field label="Venue or meeting link" wide error={errors.venue}><input name="venue" required maxLength={300} /></Field>
      </div>
      <div className="portal-settings-foot"><span className="portal-muted">{values.recipient === "all" ? `Each of the ${units.length} Local units receives a separate request.` : "The receiving unit answers in Approvals."}</span><button type="submit" className="portal-button" disabled={pending || !values.submission || !types.some(type => type.enabled)}><AddIcon size={16} aria-hidden="true" />{pending ? <Busy>Sending</Busy> : "Send request"}</button></div>
    </fieldset>
  </form>;
}

export function CommissionRequestTypeForm({ type, readOnly = false }: { type?: CommissionRequestType; readOnly?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const { state, pending, onSubmit } = useRequestAction(saveCommissionRequestType.bind(null, type?.id ?? null, type?.updated_at ?? ""), () => { setDirty(false); if (!type) form.current?.reset(); });
  return <form ref={form} onSubmit={onSubmit} onChange={() => setDirty(true)} className="portal-card cr-form">
    <h2 className="portal-card-title">{type?.name ?? "Add request type"}</h2>
    <fieldset disabled={pending || readOnly} className="cr-fields">
      <Field label="Type name" error={state.fieldErrors?.name}><input name="name" defaultValue={type?.name ?? ""} required maxLength={100} /></Field>
      <Field label="Description" error={state.fieldErrors?.description}><input name="description" defaultValue={type?.description ?? ""} maxLength={1000} /></Field>
      <label className="cr-check"><input name="enabled" type="checkbox" defaultChecked={type?.enabled ?? true} />Available for new requests</label>
    </fieldset>
    {!readOnly && <div className="portal-settings-foot"><span className="portal-muted">{dirty ? "Unsaved changes" : type ? "Saved" : "New request type"}</span><div className="cr-actions"><button type="button" className="portal-button is-ghost" disabled={!dirty || pending} onClick={() => { form.current?.reset(); setDirty(false); }}>Discard</button><button type="submit" className="portal-button" disabled={!dirty || pending}><SaveIcon size={16} aria-hidden="true" />{pending ? <Busy>Saving</Busy> : !dirty && type ? "Saved" : "Save type"}</button></div></div>}
  </form>;
}

export function CommissionRequestAnswer({ request }: { request: CommissionRequest }) {
  const { state, pending, onSubmit } = useRequestAction(answerCommissionRequestAction.bind(null, request.id, request.updated_at));
  const [decision, setDecision] = useState(request.status === "confirmed" ? "done" : "confirmed");
  return <form onSubmit={onSubmit} className="portal-card cr-form">
    <h2 className="portal-card-title">Answer the request</h2>
    <fieldset disabled={pending} className="cr-fields">
      <Field label="Decision"><Dropdown name="decision" required value={decision} onChange={setDecision} label="Decision" options={request.status === "confirmed" ? [{ value: "done", label: "Mark done" }] : [{ value: "confirmed", label: "Approve" }, { value: "declined", label: "Decline" }]} /></Field>
      <Field label="Reply to the sender" wide error={state.fieldErrors?.response}><textarea name="response" rows={4} required={decision === "declined"} maxLength={3000} /></Field>
    </fieldset>
    <div className="portal-settings-foot"><span className="portal-muted">The sender receives your answer by email.</span><button className={`portal-button ${decision === "declined" ? "is-danger" : "is-ok"}`} type="submit" disabled={pending}><SaveIcon size={16} aria-hidden="true" />{pending ? <Busy>Saving</Busy> : "Send answer"}</button></div>
  </form>;
}
