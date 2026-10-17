import type { ReactNode } from "react";
import Link from "next/link";
import { Award, Building2, GraduationCap, IdCard, Landmark } from "lucide-react";
import { TitleWithInfo } from "./info-tip";
import { SlidingSubtabs } from "./sliding-subtabs";
import { ViewOnlyTag } from "./view-only";
import "./database.css";
import { canEditSection, editsDatabase } from "@/lib/reference/data";
import type { PortalUser } from "@/lib/auth/session";

export type DatabaseTab = "colleges" | "programs" | "offices" | "positions" | "roles";

const icon = { size: 15, strokeWidth: 1.8, "aria-hidden": true } as const;

const tabs: Array<{ key: DatabaseTab; href: string; label: ReactNode }> = [
  { key: "colleges", href: "/portal/database", label: <><Building2 {...icon} /> Colleges &amp; Faculties</> },
  { key: "programs", href: "/portal/database/programs", label: <><GraduationCap {...icon} /> Programs &amp; Majors</> },
  { key: "offices", href: "/portal/database/offices", label: <><Landmark {...icon} /> Admin Offices</> },
  { key: "positions", href: "/portal/database/positions", label: <><Award {...icon} /> Positions</> },
  { key: "roles", href: "/portal/database/roles", label: <><IdCard {...icon} /> Roles</> },
];

/** Administrative → Database: the page head and the five lists' tabs, shared by each list's page. */
export function DatabaseHead({ current, viewOnly, note, actions, back }: { current: DatabaseTab; viewOnly: boolean; note?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return <>
    <header className="portal-page-head">
      <div>
        {back && <Link className="portal-back" href={back.href}>← {back.label}</Link>}
        <p className="portal-eyebrow">Administrative</p>
        <TitleWithInfo info="The lists every form, dropdown and recruitment page reads: colleges and faculties, their programs, the university’s offices, each unit’s Executive Board positions, and the roles accounts hold. Saving here changes them everywhere at once. Only official accounts can change them; a Local official account changes its own unit’s programs, positions and roles.">Database</TitleWithInfo>
        {note && <p className="portal-muted">{note}</p>}
      </div>
      {(viewOnly || actions) && <div className="portal-head-actions">{actions}{viewOnly && <ViewOnlyTag />}</div>}
    </header>
    <SlidingSubtabs className="db-subtabs" active={current} label="Database lists" scope="database" items={tabs} />
  </>;
}

/** Why the list is read-only for this account, said under the title; nothing when it can edit. */
export function databaseNote(user: PortalUser, section: string, loadError: string | null) {
  if (loadError) return null;
  if (canEditSection(user, section)) return null;
  if (!editsDatabase(user)) return "Only official accounts can change the Database.";
  return user.affiliation === "local" ? "Only the Central Comelec’s official account can change this list." : null;
}
