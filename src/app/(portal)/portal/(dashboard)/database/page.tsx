import type { Metadata } from "next";
import { CollegesEditor } from "@/components/portal/database-editors";
import { DatabaseHead, databaseNote } from "@/components/portal/database-tabs";
import { requireAccess } from "@/lib/auth/session";
import { canEditSection } from "@/lib/reference/data";
import { loadReferenceData } from "@/lib/reference/store";

export const metadata: Metadata = { title: "Colleges & Faculties · Database" };

export default async function DatabaseCollegesPage() {
  const user = await requireAccess("database");
  const { data, error } = await loadReferenceData();
  const readOnly = Boolean(error) || !canEditSection(user, "colleges");
  return (
    <main className="portal-page is-wide">
      <DatabaseHead current="colleges" viewOnly={readOnly} note={databaseNote(user, "colleges", error)} />
      {/* Editing is off when the saved lists couldn't be read, so the defaults never overwrite them. */}
      {error && <p className="portal-form-error db-load-error" role="alert">{error}</p>}
      <CollegesEditor initial={data.colleges} stamp={data.stamps.colleges ?? null} readOnly={readOnly} />
    </main>
  );
}
