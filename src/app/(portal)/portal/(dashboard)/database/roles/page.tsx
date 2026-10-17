import type { Metadata } from "next";
import { RolesWorkspace } from "@/components/portal/database-editors";
import { DatabaseHead, databaseNote } from "@/components/portal/database-tabs";
import { requireAccess } from "@/lib/auth/session";
import { canEditSection, sectionKey } from "@/lib/reference/data";
import { loadReferenceData } from "@/lib/reference/store";

export const metadata: Metadata = { title: "Roles · Database" };

export default async function DatabaseRolesPage({ searchParams }: PageProps<"/portal/database/roles">) {
  const { unit: asked, from } = await searchParams;
  const user = await requireAccess("database");
  const { data, error } = await loadReferenceData();
  const units = data.colleges.filter((college) => college.comelec).map((college) => college.name).sort((a, b) => a.localeCompare(b));
  const local = user.affiliation === "local";
  const unit = local ? user.college : typeof asked === "string" && units.includes(asked) ? asked : "";
  const section = sectionKey.roles(local ? unit ?? "" : "");
  const readOnly = Boolean(error) || (local && unit === null) || !canEditSection(user, section);
  const namesReadOnly = Boolean(error) || !canEditSection(user, "role-names");
  // Opened from Recruitment → Slots ("Add roles"): the back link returns to that unit's slots.
  const back = from === "slots" ? { href: `/portal/recruitment/slots${unit ? `?unit=${encodeURIComponent(unit)}` : ""}`, label: "Recruitment slots" } : undefined;
  return (
    <main className="portal-page is-wide">
      <DatabaseHead current="roles" viewOnly={readOnly && namesReadOnly} note={databaseNote(user, section, error)} back={back} />
      {error && <p className="portal-form-error db-load-error" role="alert">{error}</p>}
      {local && unit === null ? (
        <p className="portal-empty">Your account has no college set.</p>
      ) : (
        <RolesWorkspace units={units} data={data} initial={unit ?? ""} readOnly={readOnly} namesReadOnly={namesReadOnly} local={local} />
      )}
    </main>
  );
}
