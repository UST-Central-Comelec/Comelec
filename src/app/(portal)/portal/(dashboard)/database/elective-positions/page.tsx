import type { Metadata } from "next";
import { ElectivePositionsWorkspace } from "@/components/portal/database-editors";
import { DatabaseHead } from "@/components/portal/database-tabs";
import { requireAccess } from "@/lib/auth/session";
import { loadElectivePositions } from "@/lib/candidacy/positions-store";
import { editsDatabase } from "@/lib/reference/data";
import { loadReferenceData } from "@/lib/reference/store";

export const metadata: Metadata = { title: "Elective positions · Database" };

/** Each unit's elective positions, which candidates run for on Filing of Candidacy. */
export default async function DatabaseElectivePositionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { unit: asked } = await searchParams;
  const user = await requireAccess("database");
  const [{ data }, loaded] = await Promise.all([loadReferenceData(), loadElectivePositions()]);
  const units = data.colleges.filter((college) => college.comelec).map((college) => college.name).sort((a, b) => a.localeCompare(b));
  // A Local account sees its own unit’s; the Central Comelec starts on its own and can pick any other.
  const local = user.affiliation === "local";
  const unit = local ? user.college : typeof asked === "string" && units.includes(asked) ? asked : "";
  const readOnly = Boolean(loaded.error) || (local && unit === null) || !editsDatabase(user);
  const note = loaded.error ? null : !editsDatabase(user) ? "Only official accounts can change the Database." : null;
  return (
    <main className="portal-page is-wide">
      <DatabaseHead current="elective" viewOnly={readOnly} note={note} />
      {loaded.error && <p className="portal-form-error db-load-error" role="alert">{loaded.error}</p>}
      {local && unit === null ? (
        <p className="portal-empty">Your account has no college set.</p>
      ) : (
        <ElectivePositionsWorkspace units={units} positions={loaded.positions} stamps={loaded.stamps} initial={unit} readOnly={readOnly} local={local}
          info={<>The offices candidates run for, in order: the Central Student Council’s Executive Board, and each Local Student Council’s. Filing of Candidacy offers the unit’s list. A unit that hasn’t saved its own starts with the CSC Executive Board (President, Vice-President, Secretary, Treasurer, Auditor, Public Relations Officer). Renaming a position doesn’t change filings already made.</>} />
      )}
    </main>
  );
}
