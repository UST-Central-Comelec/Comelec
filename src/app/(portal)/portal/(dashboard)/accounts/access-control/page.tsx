import type { Metadata } from "next";
import { AccessLevelPicker } from "@/components/portal/access-level-picker";
import { AccessControlForm, type AccessGroup } from "@/components/portal/access-control-form";
import { AccountsTabs } from "@/components/portal/accounts-tabs";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { formatClosing } from "@/lib/applications/period";
import { builtInUser, requireFullAccess, withPortalUser } from "@/lib/auth/session";
import { getAccounts } from "@/lib/data/queries";
import { FULL_ACCESS, accessLevelOf, accessLevels, defaultTabs, isAccessLevel, isBoardTab, isLocalLevel, isLocalTab, levelTabs, tabGroups, type AccessLevel } from "@/lib/portal/access";
import { updateAccess } from "@/lib/portal/access-actions";
import { getSavedAccess } from "@/lib/portal/access-store";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Access control" };

/** Who each level is, and what holds for it whatever is switched on. */
const levelNotes: Record<AccessLevel, string> = {
  "central-board": "The Central Comelec’s Executive Board. Everything is open to it, for Central and Local alike, and it’s the only level that sees this page, so its access can’t be switched off.",
  "local-board": "Each college’s Local Executive Board. Whatever is switched on, they only see and manage their own college’s records.",
  "central-associate": "Executive Associates of the Central Comelec. They see every unit’s records in the tabs switched on.",
  "local-associate": "Executive Associates of each college’s Local Comelec. Whatever is switched on, they only see and manage their own college’s records.",
  deputy: "Deputies, Central and Local. A Local deputy only gets the tabs marked Local, and only their own college’s records there.",
  "central-adviser": "Advisers of the Central Comelec. View only: they read every unit’s records in the tabs switched on, and change nothing.",
  "local-adviser": "Advisers of each college’s Local Comelec. View only: they read their own college’s records in the tabs switched on, and change nothing.",
  admin: "Admins, from the Office for Student Affairs. View only: they read every unit’s records in the tabs switched on, and change nothing.",
  "central-official": "The Central Comelec’s official account, where it isn’t the built-in executive (which always has everything). It stands as the Central Executive Board in the tabs switched on, but doesn’t see this page.",
  "local-official": "Each Local unit’s official account, like comelec.sci@ust.edu.ph. It stands as its college’s Executive Board in the tabs switched on, with the Email Sender besides, and only sees its own college’s records.",
};

/** The levels in the picker, under what they're levels of. */
const levelGroups: Record<AccessLevel, string> = {
  "central-board": "Commissioners",
  "local-board": "Commissioners",
  "central-associate": "Commissioners",
  "local-associate": "Commissioners",
  deputy: "Commissioners",
  "central-adviser": "View only",
  "local-adviser": "View only",
  admin: "View only",
  "central-official": "Official accounts",
  "local-official": "Official accounts",
};

export default async function AccessControlPage({ searchParams }: PageProps<"/portal/accounts/access-control">) {
  const [, [{ value: saved, error: loadError }, accounts, { level: levelParam, notice }]] = await withPortalUser(Promise.all([settle(getSavedAccess()), getAccounts(builtInUser()?.email), searchParams]), requireFullAccess);
  const level: AccessLevel = isAccessLevel(levelParam) ? levelParam : "local-board";
  const locked = level === FULL_ACCESS;
  const localOnly = isLocalLevel(level);

  const open = levelTabs(level, saved?.overrides);
  const groups: AccessGroup[] = tabGroups.map((group) => ({
    label: group.label,
    tabs: group.tabs.map((tab) => {
      // A Local level can't be given a tab with no college's records of its own in it, and nobody
      // but the Central Executive Board the tab where revisions are signed.
      const centralOnly = !isLocalTab(tab.key);
      const boardOnly = isBoardTab(tab.key);
      const off = (localOnly && centralOnly) || (boardOnly && !locked);
      return { key: tab.key, label: tab.label, on: !off && open.includes(tab.key), byDefault: !off && defaultTabs[level].includes(tab.key), fixed: locked || off, centralOnly, boardOnly };
    }),
  }));

  const active = accounts.filter((account) => account.active);
  // The built-in executive is Central Executive Board whatever its row says.
  const count = (which: AccessLevel) => active.filter((account) => (account.builtIn ? FULL_ACCESS : accessLevelOf(account)) === which).length;
  const levels = (Object.keys(accessLevels) as AccessLevel[]).map((value) => ({ value, label: `${accessLevels[value]} · ${count(value)}`, group: levelGroups[value] }));
  const changed = level !== FULL_ACCESS ? saved?.updated[level] : undefined;
  const updated = changed && changed.by !== "system" ? `Last changed by ${changed.by} · ${formatClosing(changed.at)}` : null;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Administrative</p>
          <TitleWithInfo info="What each level of account may open. An account’s level comes from its category, affiliation and position, set under Accounts. Switch a tab off and it leaves that level’s sidebar, and its pages stop opening for them, from their next click. Only the Central Executive Board sees and changes these.">Accounts</TitleWithInfo>
        </div>
      </header>
      <AccountsTabs current="access-control" showBoardTabs />
      <Notice notice={notice} />

      {loadError && (
        <p className="portal-form-error" role="alert">
          Couldn’t load the saved access control, so every level is on its defaults. Run <code>supabase/migrations/0021_account_profiles_and_access.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      )}

      <section className="portal-card portal-settings" aria-labelledby="access-title">
        <header className="portal-settings-head">
          <div>
            <h2 className="portal-card-title" id="access-title">{accessLevels[level]} access</h2>
            <p className="portal-muted portal-access-note">{levelNotes[level]}</p>
          </div>
          <AccessLevelPicker levels={levels} value={level} />
        </header>
        {/* Keyed on what's saved, so the switches follow it after a save. */}
        <AccessControlForm key={`${level}-${open.join()}`} action={level === FULL_ACCESS ? null : updateAccess.bind(null, level)} groups={groups} updated={updated} scopes={localOnly || level === "deputy"} />
      </section>
    </main>
  );
}
