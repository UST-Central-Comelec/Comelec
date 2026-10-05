"use client";
import { startTransition, useActionState, type FormEvent } from "react";
import { requirements } from "@/lib/polpar/content";
import { savePartyReview } from "@/lib/polpar/review-actions";
import type { PartyReview } from "@/lib/polpar/store";
import { toManilaInput } from "@/lib/applications/period";
import { Field, useHydrated } from "@/components/portal/portal-form";

export function PartyReviewForm({ id, review, readOnly }: { id: string; review: PartyReview; readOnly: boolean }) {
  const [state, action, pending] = useActionState(savePartyReview.bind(null, id), undefined);
  const hydrated = useHydrated();
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); startTransition(() => action(form)); };
  return <form onSubmit={submit} method="post" className="portal-form"><fieldset disabled={readOnly || pending} style={{ border: 0, padding: 0 }}>
    <div className="portal-form-grid"><Field label="Received by · Commissioner"><input name="receivedBy" defaultValue={review.receivedBy ?? ""} maxLength={250} /></Field><Field label="Certified true and complete by · Legal Head"><input name="certifiedBy" defaultValue={review.certifiedBy ?? ""} maxLength={250} /></Field><Field label="Date and time received · Philippine time"><input type="datetime-local" name="receivedAt" defaultValue={review.receivedAt ? toManilaInput(review.receivedAt) : ""} /></Field></div>
    <div style={{ display: "grid", gap: 12, marginBlock: 24 }}>{requirements.map((item) => <label key={item.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}><input type="checkbox" name="checked" value={item.id} defaultChecked={review.checked?.includes(item.id)} /><span>{item.label}</span></label>)}</div>
    <Field label="Review remarks"><textarea name="remarks" rows={4} maxLength={5000} defaultValue={review.remarks ?? ""} /></Field>
    {!readOnly && <div className="portal-form-footer">{state?.error ? <p role="alert" className="portal-form-error">{state.error}</p> : state?.saved ? <p role="status">Checklist saved.</p> : <span />}<button className="portal-button" disabled={pending || !hydrated}>{pending ? "Saving…" : "Save Commission checklist"}</button></div>}
  </fieldset></form>;
}
