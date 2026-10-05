import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CodeEditor } from "@/components/portal/code-editor";
import { Notice } from "@/components/portal/notice";
import { formatClosing } from "@/lib/applications/period";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { canEditCodes, codes, isCodeKey, versionName } from "@/lib/codes/options";
import { getOpenRevision, getPublishedCode, isCodesMissing } from "@/lib/codes/store";
import { tidyArticles } from "@/lib/codes/text";
import { tabHref } from "@/lib/portal/access";
import { discardCodeRevision, saveCodeRevision } from "@/lib/portal/code-actions";
import { settle } from "@/lib/portal/settle";

export async function generateMetadata({ params }: PageProps<"/portal/codes/[code]/edit">): Promise<Metadata> {
  const { code } = await params;
  return { title: isCodeKey(code) ? `Revise ${codes[code].the}` : "Not found" };
}

/**
 * Where the Legal Head, the Secretary to the Adjudicatory and their offices write a revision. It
 * opens on the draft in progress, or on the published text when there's none; a revision that's
 * waiting to be approved is locked, so it opens on that revision's page instead.
 */
export default async function ReviseCodePage({ params, searchParams }: PageProps<"/portal/codes/[code]/edit">) {
  const [{ code }, { notice }] = await Promise.all([params, searchParams]);
  if (!isCodeKey(code)) notFound();
  const { tab, title, the } = codes[code];
  const home = tabHref(tab);
  const [user, [published, open]] = await withPortalUser(Promise.all([getPublishedCode(code), settle(getOpenRevision(code))]), allowed(tab));
  if (user.readOnly || !canEditCodes(user)) redirect(home);

  const revision = open.value;
  if (revision?.status === "pending") redirect(`${home}/revisions/${revision.id}`);
  // A draft is measured against the text it was started from; a new one, against what's published now.
  const base = revision ? revision.baseArticles : tidyArticles(published.articles);

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href={home}>← {title}</Link>
          <h1>Revise {the}</h1>
          <p className="portal-muted">
            {revision ? `A draft started by ${revision.author.name} on ${formatClosing(revision.createdAt)}.` : "Nothing is saved until you press Save draft."} The website keeps showing {published.version > 0 ? versionName(published.version).toLowerCase() : "the text as signed"} until the revision is approved.
          </p>
        </div>
        {revision && <div className="portal-head-actions"><Link className="portal-button is-ghost" href={`${home}/revisions/${revision.id}`}>See the revision</Link></div>}
      </header>
      <Notice notice={notice} />

      {open.error && (
        <p className="portal-form-error" role="alert">
          {isCodesMissing(open.error) ? <>Revisions need a database update first. Run <code>supabase/migrations/0025_code_revisions.sql</code> in the Supabase SQL Editor, then reload. Until then a draft can’t be saved.</> : <>Couldn’t check for a draft in progress, so saving may be refused. Reload the page to try again. ({open.error})</>}
        </p>
      )}

      {revision?.returned && (
        <section className="portal-card portal-event-request is-pending" aria-label="Sent back for changes">
          <p className="portal-eyebrow">Sent back for changes by the {revision.returned.role}</p>
          <blockquote className="portal-request-text">{revision.returned.note}</blockquote>
          <p className="portal-muted">{revision.returned.name} · {formatClosing(revision.returned.at)}. Make the changes, then send it for approval again.</p>
        </section>
      )}

      <CodeEditor
        code={code}
        base={base}
        initial={revision ? revision.articles : base}
        draft={revision ? { id: revision.id, edits: revision.edits, at: revision.updatedAt } : null}
        note={revision?.summary ?? ""}
        save={saveCodeRevision.bind(null, code)}
        discard={discardCodeRevision.bind(null, code)}
      />
    </main>
  );
}
