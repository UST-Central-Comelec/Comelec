import type { Metadata } from "next";
import { NamesEditor } from "@/components/portal/database-editors";
import { DatabaseHead, databaseNote } from "@/components/portal/database-tabs";
import { requireAccess } from "@/lib/auth/session";
import { canEditSection } from "@/lib/reference/data";
import { loadReferenceData } from "@/lib/reference/store";

export const metadata: Metadata = { title: "Admin Offices · Database" };

export default async function DatabaseOfficesPage() {
  const user = await requireAccess("database");
  const { data, error } = await loadReferenceData();
  const readOnly = Boolean(error) || !canEditSection(user, "offices");
  return (
    <main className="portal-page is-wide">
      <DatabaseHead current="offices" viewOnly={readOnly} note={databaseNote(user, "offices", error)} />
      {error && <p className="portal-form-error db-load-error" role="alert">{error}</p>}
      <NamesEditor title="Admin Offices" noun="office" initial={data.offices} stamp={data.stamps.offices ?? null} readOnly={readOnly} maxLength={300}
        savedMessage="Admin offices saved. The Letters Tracker now suggests them."
        empty="No offices yet."
        info={<>The university’s offices, in the order the Letters Tracker suggests them as destinations. Each college and faculty’s Dean and Regent follow them, from Colleges &amp; Faculties. Letters already sent keep the destination they were saved with.</>} />
    </main>
  );
}
