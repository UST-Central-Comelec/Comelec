"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { addressSubmissionEdit } from "@/lib/applications/edit-request-actions";
import type { SubmissionEditKind, SubmissionEditReview } from "@/lib/applications/edit-requests";
import { TitleWithInfo } from "./info-tip";
import { ViewOnly, ViewOnlyTag } from "./view-only";
import { toast } from "./toast";

export function SubmissionEditRequests({ kind, requests, readOnly }: { kind: SubmissionEditKind; requests: SubmissionEditReview[]; readOnly: boolean }) {
  const [addressed, setAddressed] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const working = useRef(false);
  if (!requests.length) return null;
  function address(id: string) {
    if (working.current) return;
    working.current = true;
    startTransition(async () => {
      try {
        const result = await addressSubmissionEdit(kind, id);
        if (result.error || !result.saved) { toast(result.error ?? "Couldn’t address this request. Try again.", "error"); return; }
        setAddressed(current => [...current, id]);
        toast("Edit request marked as addressed.");
      } catch (error) {
        unstable_rethrow(error);
        toast("Couldn’t address this request. Try again.", "error");
      } finally { working.current = false; }
    });
  }
  return <section className="portal-card" aria-label="Submission edit requests">
    <header className="portal-card-head"><TitleWithInfo as="h2" className="portal-card-title" info="Changes requested through Tracking Application. Review each request, arrange the correction, and mark it addressed when finished.">Edit requests</TitleWithInfo>{readOnly && <ViewOnlyTag />}</header>
    <ViewOnly when={readOnly}>
    {requests.map(request => <article key={request.id} className="portal-response-edit-request">
      <header><h3>{request.subject.first_name} {request.subject.last_name}</h3><span className={`portal-tag ${addressed.includes(request.id) ? "is-ok" : "is-gold"}`}>{addressed.includes(request.id) ? "Addressed" : "Edit requested"}</span></header>
      <small className="portal-muted">{request.subject.reference_code} · {request.subject.college} · Requested {new Date(request.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</small>
      <p>{request.requested_changes}</p>
      {kind === "application" && <Link className="portal-button is-small is-ghost" href={`/portal/recruitment/applications?application=${request.application_id}&body=all`}>Review application</Link>}
      {!readOnly && !addressed.includes(request.id) && <button type="button" className="portal-button is-small is-ghost" disabled={pending} onClick={() => address(request.id)}>Mark request as addressed</button>}
    </article>)}
    </ViewOnly>
  </section>;
}
