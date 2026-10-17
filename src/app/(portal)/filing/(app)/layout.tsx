import { cookies } from "next/headers";
import { FilingSidebar, FilingTopbar } from "@/components/filing-portal/shell";
import { PortalShell } from "@/components/portal/portal-theme";
import { ToastStack } from "@/components/portal/toast-stack";
import { countAccountNotices } from "@/lib/filing-portal/accounts";
import { isContactPerson, requireFilingAccount } from "@/lib/filing-portal/session";
import { FILING_SIDEBAR_COOKIE, fullName } from "@/lib/filing-portal/types";
import { countPartyNotices } from "@/lib/party-portal/store";
import { readTheme, THEME_COOKIE } from "@/lib/portal/theme";
import "@/components/filing-portal/documents.css";
import "./filing-portal.css";

/** Every signed-in filing portal page: the sidebar, the top bar, and the header's pop-ups. */
export default async function FilingPortalLayout({ children }: { children: React.ReactNode }) {
  const filing = await requireFilingAccount();
  const { account, membership, candidacy } = filing;
  const cookieStore = await cookies();
  const member = membership?.member.status === "active" ? membership : null;
  const [own, party] = await Promise.all([countAccountNotices(account.id, account.noticesReadAt), member ? countPartyNotices(member.member, account.noticesReadAt) : 0]);
  // What they are here: the party's contact person or member, a candidate, or both.
  const roles = [member && (isContactPerson(member) ? "Party contact person" : "Party member"), candidacy && "Candidate"].filter(Boolean);
  const summary = [membership && membership.party.name, candidacy && `Running for ${candidacy.position}`].filter(Boolean).join(" · ");

  return (
    <PortalShell initialTheme={readTheme(cookieStore.get(THEME_COOKIE)?.value)} cookiePath="/filing">
      <FilingSidebar account={{ name: fullName(account), email: account.email, role: roles.join(" · ") || "Filer", summary, party: Boolean(member), candidacy: Boolean(candidacy) }} unread={own + party} initialCollapsed={cookieStore.get(FILING_SIDEBAR_COOKIE)?.value === "collapsed"} />
      <div className="portal-main pp-app">
        <FilingTopbar />
        {children}
      </div>
      <ToastStack />
    </PortalShell>
  );
}
