import type { Metadata } from "next";
import { ProgramsWorkspace } from "@/components/portal/database-editors";
import { DatabaseHead, databaseNote } from "@/components/portal/database-tabs";
import { requireAccess } from "@/lib/auth/session";
import { canEditSection, sectionKey } from "@/lib/reference/data";
import { loadReferenceData, programUsage } from "@/lib/reference/store";

export const metadata: Metadata = { title: "Programs & Majors · Database" };

export default async function DatabaseProgramsPage({ searchParams }: PageProps<"/portal/database/programs">) {
  const { unit: asked } = await searchParams;
  const user = await requireAccess("database");
  const [{ data, error }, usage] = await Promise.all([loadReferenceData(), programUsage()]);
  const names = data.colleges.map((college) => college.name).sort((a, b) => a.localeCompare(b));
  // A Local account sees its own college's; the Central Comelec types or picks one, and sees nothing until it does.
  const local = user.affiliation === "local";
  const college = local ? user.college : typeof asked === "string" && names.includes(asked) ? asked : null;
  const section = college ? sectionKey.programs(college) : "";
  const readOnly = Boolean(error) || !college || !canEditSection(user, section);
  // The Central Comelec's official account can change every college's; check against any one.
  const canEdit = !error && names.length > 0 && canEditSection(user, sectionKey.programs(names[0]));
  const info = <>The degree programs, majors and specializations students of a college pick from, in this order, on Apply, Request access, accounts and event registration. Type or pick a college or faculty to see its list. A school with none (like Junior High School) shows “None”. Renaming a program updates the accounts that have it; applications and registrations keep the name they were sent with. Retire a program to take it off the forms: those who have it keep it.</>;
  return (
    <main className="portal-page is-wide">
      <DatabaseHead current="programs" viewOnly={local ? readOnly : !canEdit} note={local ? databaseNote(user, section, error) : names[0] ? databaseNote(user, sectionKey.programs(names[0]), error) : null} />
      {error && <p className="portal-form-error db-load-error" role="alert">{error}</p>}
      {local && !college ? (
        <p className="portal-empty">Your account has no college set.</p>
      ) : (
        <ProgramsWorkspace colleges={names} programs={data.programs} stamps={data.stamps} usage={local && college ? { [college]: usage[college] ?? {} } : usage} initial={college} readOnly={local ? readOnly : !canEdit} local={local} info={info} />
      )}
    </main>
  );
}
