import { cookies } from "next/headers";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { SessionTimeout } from "@/components/portal/session-timeout";
import { ACTIVITY_COOKIE } from "@/lib/security/portal-session";
import { SIDEBAR_COOKIE } from "@/lib/portal/sidebar";
import { accountRoles } from "@/lib/data/types";
import { requirePortalUser } from "@/lib/auth/session";

export default async function PortalShellLayout({ children }: LayoutProps<"/portal">) {
  const user = await requirePortalUser();
  const cookieStore = await cookies();
  // Only for the countdown shown in the browser; the proxy verifies the signed cookie itself.
  const startedAt = Number(cookieStore.get(ACTIVITY_COOKIE)?.value.split(".")[1]) || null;
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="portal-shell">
      <PortalSidebar
        user={{ name: user.name, role: user.affiliation === "local" ? `Local ${accountRoles[user.role]}` : accountRoles[user.role], email: user.email, isExecutive: user.role === "executive", isLocal: user.affiliation === "local" }}
        initialCollapsed={collapsed}
      />
      <div className="portal-main">{children}</div>
      <SessionTimeout startedAt={startedAt} />
    </div>
  );
}
