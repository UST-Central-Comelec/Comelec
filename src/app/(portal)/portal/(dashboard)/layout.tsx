import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, LogOut } from "lucide-react";
import { PortalNav } from "@/components/portal/portal-nav";
import { accountRoles } from "@/lib/data/types";
import { requirePortalUser } from "@/lib/auth/session";
import { logout } from "@/lib/portal/auth-actions";

export default async function PortalShellLayout({ children }: LayoutProps<"/portal">) {
  const user = await requirePortalUser();

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <Link href="/portal" className="portal-brand">
          <Image src="/images/Logo-1.png" alt="" width={36} height={36} priority />
          <span><strong>Commission Portal</strong><small>UST Central Comelec</small></span>
        </Link>
        <PortalNav isExecutive={user.role === "executive"} />
        <div className="portal-sidebar-foot">
          <a className="portal-site-link" href="/" target="_blank" rel="noreferrer">View website <ArrowUpRight size={14} /></a>
          <div className="portal-account">
            <Link href="/portal/account" className="portal-account-link" title="My account">
              <strong>{user.name}</strong>
              <small>{accountRoles[user.role]} · {user.email}</small>
            </Link>
            <form action={logout}>
              <button className="portal-icon-button" type="submit" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
            </form>
          </div>
        </div>
      </aside>
      <div className="portal-main">{children}</div>
    </div>
  );
}
