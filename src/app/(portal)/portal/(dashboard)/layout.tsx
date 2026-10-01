import type { Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalShell } from "@/components/portal/portal-theme";
import { PortalTopbar } from "@/components/portal/portal-topbar";
import { SessionTimeout } from "@/components/portal/session-timeout";
import { ACTIVITY_COOKIE } from "@/lib/security/portal-session";
import { SIDEBAR_COOKIE } from "@/lib/portal/sidebar";
import { PHONE_QUERY, readTheme, THEME_COLOR, THEME_COOKIE } from "@/lib/portal/theme";
import { accountRoles } from "@/lib/data/types";
import { LOCAL_HOME, requirePortalUser } from "@/lib/auth/session";
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
  const cookieStore = await cookies();
  // Only for the countdown shown in the browser; the proxy verifies the signed cookie itself.
  const startedAt = Number(cookieStore.get(ACTIVITY_COOKIE)?.value.split(".")[1]) || null;
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const theme = readTheme(cookieStore.get(THEME_COOKIE)?.value);
  const isLocal = user.affiliation === "local";

  return (
    <PortalShell initialTheme={theme}>
      <PortalSidebar
        user={{ name: user.name, role: isLocal ? `Local ${accountRoles[user.role]}` : accountRoles[user.role], email: user.email, avatarUrl: user.avatarUrl ?? null, isExecutive: user.role === "executive", isLocal }}
        initialCollapsed={collapsed}
      />
      <div className="portal-main">
        <PortalTopbar home={isLocal ? LOCAL_HOME : "/portal"} />
        {/* So a website left offline doesn't go unnoticed. */}
        {settings.maintenance && (
          <p className="portal-maintenance-bar" role="status">
            <i aria-hidden="true" />
            <span>The public website is <strong>under maintenance</strong>. Visitors can’t see it.</span>
            {user.role === "executive" && <Link href="/portal/maintenance">Maintenance settings</Link>}
          </p>
        )}
        {children}
      </div>
      <SessionTimeout startedAt={startedAt} />
    </PortalShell>
  );
}
