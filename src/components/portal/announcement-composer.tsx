"use client";

import Link from "next/link";
import { useState } from "react";
import { Send } from "lucide-react";
import { Field, useHydrated, usePortalForm } from "./portal-form";
import { sendAnnouncement } from "@/lib/portal/inbox-actions";
import { DocumentBodyField } from "./document-body-field";

export function AnnouncementComposer({ broadcast, unit }: { broadcast: boolean; unit: string }) {
  const { state, pending, onSubmit, errors } = usePortalForm(sendAnnouncement);
  const hydrated = useHydrated();
  const [body, setBody] = useState("");
  return (
      <form onSubmit={onSubmit} className="portal-card portal-inbox-form">
        <div className="portal-announcement-form-intro"><h2>Announcement details</h2><p>Your message will appear in the recipients’ portal inbox.</p></div>
        <Field label="Recipients" error={errors.audience}>
          <select name="audience" defaultValue="unit"><option value="unit">{unit} commissioners</option>{broadcast && <option value="all">All units and commissioners</option>}</select>
        </Field>
        <Field label="Title" error={errors.title}><input name="title" required minLength={3} maxLength={160} placeholder="Give your update a clear title" /></Field>
        <div className={`portal-field${errors.body ? " has-error" : ""}`}>
          <span className="portal-field-label">Message</span>
          <DocumentBodyField value={body} onChange={setBody} invalid={Boolean(errors.body)} label="Message editor" windowTitle="Edit message" />
          {errors.body && <span className="portal-field-error">{errors.body}</span>}
        </div>
        {state?.error && <p className="portal-form-error" role="alert">{state.error}</p>}
        <div className="portal-announcement-form-actions"><Link className="portal-button is-ghost" href="/portal/apps/inbox">Cancel</Link><button type="submit" className="portal-button" disabled={!hydrated || pending}><Send size={15} aria-hidden="true" />{pending ? "Sending…" : "Send announcement"}</button></div>
      </form>
  );
}
