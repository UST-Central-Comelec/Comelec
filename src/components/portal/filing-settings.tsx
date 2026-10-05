import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { canOpen, isLocal, requireAccess } from "@/lib/auth/session";
import { filingKinds, type FilingKind } from "@/lib/filings/kinds";

// The Settings subtab of each is src/components/portal/period-settings.tsx, shared with Recruitment.

/** The list subtab of PolPaR and of Filing of Candidacy. There's no online form yet, so nothing comes in. */
export async function FilingSubmissions({ kind }: { kind: FilingKind }) {
  const { title, section, noun, href, portalHref, tabs } = filingKinds[kind];
  const user = await requireAccess(tabs.submissions);
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  // Local accounts only see their own college's, once there are any.
  const local = isLocal(user);

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">{section}</p>
          <TitleWithInfo info={local ? `${Noun} from ${user.college ?? "your college"} submitted through the ${title} page will show up here.` : `${Noun} submitted through the ${title} page will show up here.`}>{Noun}</TitleWithInfo>
          {local && <p className="portal-muted">{user.college}</p>}
        </div>
        <Link className="portal-button is-ghost" href={href} target="_blank">View Mode <ArrowUpRight size={15} /></Link>
      </header>

      <section className="portal-card">
        {local ? (
          <p className="portal-empty">No {noun} from your college yet.</p>
        ) : canOpen(user, tabs.settings) ? (
          <p className="portal-empty">No {noun} yet. Open or close {title} under <Link href={`${portalHref}/settings`}>Settings</Link>.</p>
        ) : (
          <p className="portal-empty">No {noun} yet.</p>
        )}
      </section>
    </main>
  );
}
