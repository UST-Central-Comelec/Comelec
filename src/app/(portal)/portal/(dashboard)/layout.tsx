import type { Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { AccountSwitchTransition } from "@/components/portal/account-switch-transition";
import { OnlineProvider } from "@/components/portal/online-provider";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalShell } from "@/components/portal/portal-theme";
import { PortalTopbar } from "@/components/portal/portal-topbar";
import { SessionTimeout } from "@/components/portal/session-timeout";
import { getPortalAttention } from "@/lib/portal/attention";
import { ACTIVITY_COOKIE } from "@/lib/security/portal-session";
import { FULL_ACCESS } from "@/lib/portal/access";
import { SIDEBAR_COOKIE } from "@/lib/portal/sidebar";
import { PHONE_QUERY, readTheme, THEME_COLOR, THEME_COOKIE } from "@/lib/portal/theme";
import { describeRole } from "@/lib/data/accounts";
import { canOpen, getPortalMemberships, homeFor, isLocal, requirePortalUser } from "@/lib/auth/session";
import { getSiteSettingsForSite } from "@/lib/site-settings/store";

// The browser's own bars take the colour of what's at the top of the page: in the light theme that's
// the light page on a wide screen, and still the dark header on a phone. The root layout's dark one
// covers the sign-in page.
export async function generateViewport(): Promise<Viewport> {
  if (readTheme((await cookies()).get(THEME_COOKIE)?.value) === "dark") return { themeColor: THEME_COLOR.dark };
  return { themeColor: [{ media: PHONE_QUERY, color: THEME_COLOR.dark }, { media: `not ${PHONE_QUERY}`, color: THEME_COLOR.light }] };
}

export default async function PortalShellLayout({ children }: LayoutProps<"/portal">) {
  const [user, settings] = await Promise.all([requirePortalUser(), getSiteSettingsForSite()]);
  // The badge counts aren't awaited: the page goes out without waiting for the slowest of their
  // queries, and the sidebar fills them in when they arrive, in this same response.
  const attention = getPortalAttention(user);
  const memberships = await getPortalMemberships();
  const cookieStore = await cookies();
  // Only for the countdown shown in the browser; the proxy verifies the signed cookie itself.
  const activity = cookieStore.get(ACTIVITY_COOKIE)?.value.split(".") ?? [];
  const startedAt = Number(activity[1]) || null;
  // "Keep me signed in": no idle or 8-hour limits to count down (session id.started.last.remember.signature).
  const remembered = activity.length === 5 && activity[3] === "1";
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const theme = readTheme(cookieStore.get(THEME_COOKIE)?.value);
  // The line under their name: "Chairperson", or "Chairperson (Local)" for a Local account.
  const role = `${describeRole(user)}${isLocal(user) ? " (Local)" : ""}`;

  return (
    <AccountSwitchTransition accountId={user.id}>
      <PortalShell initialTheme={theme}>
        {/* Who's online, chat and following: one connection for the pills in the topbar and the phone header. */}
        <OnlineProvider>
          <PortalSidebar
            user={{ id: user.id, name: user.name, role, email: user.email, avatarUrl: user.avatarUrl ?? null, tabs: user.tabs, showAccessControl: user.level === FULL_ACCESS }}
            memberships={memberships.map((account) => ({ id: account.id, affiliation: account.affiliation, college: account.college, role: describeRole(account) }))}
            key={user.id}
            initialCollapsed={collapsed}
            attention={attention}
          />
          <div className="portal-main">
            <PortalTopbar home={homeFor(user)} viewOnly={user.readOnly} />
            {/* So a website left offline doesn't go unnoticed. */}
            {settings.maintenance && (
              <p className="portal-maintenance-bar" role="status">
                <i aria-hidden="true" />
                <span>The public website is <strong>under maintenance</strong>. Visitors can’t see it.</span>
                {canOpen(user, "maintenance") && <Link href="/portal/maintenance">Maintenance settings</Link>}
              </p>
            )}
            {children}
          </div>
        </OnlineProvider>
        {!remembered && <SessionTimeout startedAt={startedAt} />}
      </PortalShell>
    </AccountSwitchTransition>
  );
}
