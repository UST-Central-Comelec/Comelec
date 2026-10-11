import type { Metadata } from "next";
import { AccessLevelPicker } from "@/components/portal/access-level-picker";
import { AccessControlForm, type AccessGroup } from "@/components/portal/access-control-form";
import { Notice } from "@/components/portal/notice";
import { formatClosing } from "@/lib/applications/period";
import { builtInUser, requireFullAccess, withPortalUser } from "@/lib/auth/session";
import { getAccounts } from "@/lib/data/queries";
import { FULL_ACCESS, accessLevelOf, accessLevels, defaultTabs, isAccessLevel, isLocalTab, levelTabs, accessTabGroups, type AccessLevel } from "@/lib/portal/access";
import { updateAccess } from "@/lib/portal/access-actions";
import { getSavedAccess } from "@/lib/portal/access-store";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Access control" };

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

  const open = levelTabs(level, saved?.overrides);
  const groups: AccessGroup[] = accessTabGroups.map((group) => ({
    label: group.label,
    section: group.section,
    tabs: group.tabs.map((tab) => {
      const centralOnly = !isLocalTab(tab.key);
      return { key: tab.key, label: tab.label, on: open.includes(tab.key), byDefault: defaultTabs[level].includes(tab.key) && (!level.startsWith("local-") || !centralOnly), fixed: false, centralOnly, boardOnly: false };
    }),
  }));

  const active = accounts.filter((account) => account.active);
  // The built-in executive is Central Executive Board whatever its row says.
  const count = (which: AccessLevel) => active.filter((account) => (account.builtIn ? FULL_ACCESS : accessLevelOf(account)) === which).length;
  const levels = (Object.keys(accessLevels) as AccessLevel[]).map((value) => ({ value, label: `${accessLevels[value]} · ${count(value)}`, group: levelGroups[value] }));
  const changed = saved?.updated[level];
  const updated = changed && changed.by !== "system" ? `Last changed by ${changed.by} · ${formatClosing(changed.at)}` : null;

  return (
    <main className="portal-access-workspace" aria-label="Access Control workspace">
      <div className="portal-access-notices">
        <Notice notice={notice} />
        {loadError && (
          <p className="portal-form-error" role="alert">
            Couldn’t load saved access, so levels are on their defaults. Run <code>supabase/migrations/0021_account_profiles_and_access.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
          </p>
        )}
      </div>
      {/* Keyed on saved access so the connections follow it after a save. */}
      <AccessControlForm key={`${level}-${open.join()}`} action={updateAccess.bind(null, level)} groups={groups} updated={updated} levelName={accessLevels[level]} rolePicker={<AccessLevelPicker levels={levels} value={level} />} />
    </main>
  );
}
