import type { Metadata } from "next";
import { UnitWorkspace } from "@/components/portal/database-editors";
import { DatabaseHead, databaseNote } from "@/components/portal/database-tabs";
import { requireAccess } from "@/lib/auth/session";
import { canEditSection, sectionKey } from "@/lib/reference/data";
import { loadReferenceData } from "@/lib/reference/store";

export const metadata: Metadata = { title: "Positions · Database" };

export default async function DatabasePositionsPage({ searchParams }: PageProps<"/portal/database/positions">) {
  const { unit: asked } = await searchParams;
  const user = await requireAccess("database");
  const { data, error } = await loadReferenceData();
  const units = data.colleges.filter((college) => college.comelec).map((college) => college.name).sort((a, b) => a.localeCompare(b));
  // A Local account sees its own unit’s; the Central Comelec starts on its own and can pick any other.
  const local = user.affiliation === "local";
  const unit = local ? user.college : typeof asked === "string" && units.includes(asked) ? asked : "";
  // A Local official account changes its own unit's; the Central one any unit's, so checking its own is enough.
  const section = sectionKey.positions(local ? unit ?? "" : "");
  const readOnly = Boolean(error) || (local && unit === null) || !canEditSection(user, section);
  return (
    <main className="portal-page is-wide">
      <DatabaseHead current="positions" viewOnly={readOnly} note={databaseNote(user, section, error)} />
      {error && <p className="portal-form-error db-load-error" role="alert">{error}</p>}
      {local && unit === null ? (
        <p className="portal-empty">Your account has no college set.</p>
      ) : (
        <UnitWorkspace units={units} data={data} initial={unit} readOnly={readOnly} local={local}
          info={<>A unit’s Executive Board, in order of rank. Each position is a role on the Executive Board; its Executive Associates serve in its office (“Office of the …”), and Recruitment → Slots lists each one as an office with its roles. Renaming one renames it on every account that holds it. A position held by an account can’t be deleted.</>} />
      )}
    </main>
  );
}
