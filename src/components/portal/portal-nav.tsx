"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, LayoutDashboard, Newspaper, ShieldCheck, Users } from "lucide-react";

const items = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/news", label: "News", icon: Newspaper },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/members", label: "Commission members", icon: Users },
  { href: "/portal/recruitment", label: "Recruitment", icon: ClipboardList },
];

const executiveItems = [{ href: "/portal/accounts", label: "Accounts", icon: ShieldCheck }];

/** `isExecutive` only decides what's shown; the account pages check the role on the server. */
export function PortalNav({ isExecutive }: { isExecutive: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="portal-nav" aria-label="Portal">
      {(isExecutive ? [...items, ...executiveItems] : items).map(({ href, label, icon: Icon }) => {
        const active = href === "/portal" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
            <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
