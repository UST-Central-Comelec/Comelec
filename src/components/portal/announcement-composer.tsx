"use client";

import { Field, useHydrated, usePortalForm } from "./portal-form";
import { sendAnnouncement } from "@/lib/portal/inbox-actions";

export function AnnouncementComposer({ broadcast, unit }: { broadcast: boolean; unit: string }) {
  const { state, pending, onSubmit, errors } = usePortalForm(sendAnnouncement);
  const hydrated = useHydrated();
  return (
    <details className="portal-card portal-announcement-compose">
      <summary>New announcement</summary>
      <form onSubmit={onSubmit} className="portal-inbox-form">
        <Field label="Recipients" error={errors.audience}>
          <select name="audience" defaultValue="unit"><option value="unit">{unit} commissioners</option>{broadcast && <option value="all">All units and commissioners</option>}</select>
        </Field>
        <Field label="Title" error={errors.title}><input name="title" required minLength={3} maxLength={160} /></Field>
        <Field label="Announcement" error={errors.body}><textarea name="body" required maxLength={20000} rows={6} /></Field>
        {state?.error && <p className="portal-form-error" role="alert">{state.error}</p>}
        <button type="submit" className="portal-button" disabled={!hydrated || pending}>{pending ? "Sending…" : "Send announcement"}</button>
      </form>
    </details>
  );
}
