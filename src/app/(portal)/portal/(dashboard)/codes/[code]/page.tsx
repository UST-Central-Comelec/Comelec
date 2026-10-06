import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BookOpenText, History, PencilLine } from "lucide-react";
import { CodeReader } from "@/components/portal/code-reader";
import { Signers, formatWhen } from "@/components/portal/code-revision";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { SlidingSubtabs } from "@/components/portal/sliding-subtabs";
import { Notice } from "@/components/portal/notice";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { formatClosing } from "@/lib/applications/period";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { describeStats } from "@/lib/codes/diff";
import { approverRoles, canEditCodes, codes, describeRevision, editorRoles, isCodeKey, signedCount, versionName } from "@/lib/codes/options";
import { getPublishedCode, isCodesMissing, listRevisions } from "@/lib/codes/store";
import { countSections } from "@/lib/codes/text";
import { tabHref } from "@/lib/portal/access";
import { settle } from "@/lib/portal/settle";

export async function generateMetadata({ params }: PageProps<"/portal/codes/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: isCodeKey(code) ? codes[code].title : "Not found" };
}

/**
 * The Constitution or the Elections Code in the portal: the text the website shows, where it
 * stands (the version published, and any revision being written or waiting to be approved), and
 * every revision there has been. The text isn't edited here: its editors write a revision.
 */
export default async function PortalCodePage({ params, searchParams }: PageProps<"/portal/codes/[code]">) {
  const [{ code }, { notice, show }] = await Promise.all([params, searchParams]);
  if (!isCodeKey(code)) notFound();
  const { tab, title, the, path } = codes[code];
  const [user, [published, revisions]] = await withPortalUser(Promise.all([getPublishedCode(code), settle(listRevisions({ code }))]), allowed(tab));

  const home = tabHref(tab);
  const edits = !user.readOnly && canEditCodes(user);
  const all = revisions.value ?? [];
  const open = all.find((revision) => revision.status === "draft" || revision.status === "pending") ?? null;
  const view = show === "revisions" ? "revisions" : "text";
  const numbered = published.articles.filter((article) => article.numeral).length;
  const state = open ? describeRevision(open) : null;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <TitleWithInfo info={`The text the website shows on its ${title} page. It isn’t edited in place: the ${editorRoles.join(", the ")} and the Executive Associates of their offices write a revision, and the website shows it once the ${approverRoles.slice(0, -1).join(", the ")} and the ${approverRoles.at(-1)} have all approved it.`}>{title}</TitleWithInfo>
        </div>
        {user.readOnly ? <ViewOnlyTag /> : edits && (open?.status === "pending" ? <Link className="portal-button is-ghost" href={`${home}/revisions/${open.id}`}>Open the revision</Link> : <Link className="portal-button" href={`${home}/edit`}><PencilLine size={16} aria-hidden="true" /> {open ? "Continue the draft" : "Revise"}</Link>)}
      </header>
      <Notice notice={notice} />

      {revisions.error && (
        <p className="portal-form-error" role="alert">
          {isCodesMissing(revisions.error) ? <>Revisions need a database update first. Run <code>supabase/migrations/0025_code_revisions.sql</code> in the Supabase SQL Editor, then reload. Until then the website shows {the} as it was signed.</> : <>Couldn’t load the revisions. Reload the page to try again. ({revisions.error})</>}
        </p>
      )}

      <section className="portal-card code-status" aria-label="Where it stands">
        <div>
          <p className="portal-index">On the website</p>
          <strong>{versionName(published.version)}</strong>
          <p className="portal-muted">
            {published.publishedAt ? `Published ${formatClosing(published.publishedAt)}.` : "No revision has been approved in the portal yet."} {numbered} {numbered === 1 ? "article" : "articles"}, {countSections(published.articles)} sections. <a href={path} target="_blank" rel="noreferrer">View on website <ArrowUpRight size={13} aria-hidden="true" /></a>
          </p>
        </div>
        <div className={open?.status === "pending" ? "is-pending" : undefined}>
          <p className="portal-index">Revision</p>
          {open && state ? (
            <>
              <strong><Link href={`${home}/revisions/${open.id}`}>{open.status === "pending" ? "Waiting to be approved" : open.returned ? "Sent back for changes" : "Being written"}</Link>{open.status === "pending" && <Signers revision={open} compact />}</strong>
              <p className="portal-muted">
                {open.status === "pending"
                  ? `${signedCount(open)} of ${approverRoles.length} approvals so far. Sent by ${open.submitted?.name ?? open.author.name}${open.submitted ? ` on ${formatWhen(open.submitted.at)}` : ""}.`
                  : open.returned
                    ? `The ${open.returned.role} sent it back on ${formatWhen(open.returned.at)}. It’s a draft again.`
                    : `A draft started by ${open.author.name}, last saved ${formatWhen(open.updatedAt)}. The website doesn’t show it.`}{" "}
                {describeStats(open.stats)}.
              </p>
            </>
          ) : (
            <>
              <strong>None in progress</strong>
              <p className="portal-muted">{edits ? `Revise ${the} to start one. Nothing changes on the website until it’s approved.` : `A revision is written by the ${editorRoles.join(" or the ")}, or their offices, and approved by the ${approverRoles.slice(0, -1).join(", the ")} and the ${approverRoles.at(-1)}.`}</p>
            </>
          )}
        </div>
      </section>

      <SlidingSubtabs active={view} label={title} scope={`codes:${code}`} items={[
        { key: "text", href: home, label: <><BookOpenText size={15} strokeWidth={1.8} aria-hidden="true" /> The text</> },
        { key: "revisions", href: `${home}?show=revisions`, label: <><History size={15} strokeWidth={1.8} aria-hidden="true" /> Revisions{all.length > 0 && <span className="portal-tag">{all.length}</span>}</> },
      ]} />

      {view === "text" ? (
        <CodeReader articles={published.articles} />
      ) : (
        <section className="portal-card is-flush">
          {all.length === 0 ? (
            <p className="portal-empty">No revisions yet. The website shows {the} as it was signed.</p>
          ) : (
            <div className="portal-table-wrap">
              <table className="portal-table code-revisions">
                <thead><tr><th>Revision</th><th>Changes</th><th>Written by</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {all.map((revision) => {
                    const tag = describeRevision(revision);
                    return (
                      <tr key={revision.id}>
                        <td>
                          <Link className="portal-row-title" href={`${home}/revisions/${revision.id}`}>{revision.version ? `Version ${revision.version}` : revision.status === "discarded" ? "Discarded draft" : "In progress"}</Link>
                          {revision.summary && <small className="portal-muted code-revisions-note">{revision.summary}</small>}
                        </td>
                        <td className="portal-muted">{describeStats(revision.stats)}</td>
                        <td>{revision.author.name}<small className="portal-muted">{revision.author.role}</small></td>
                        <td><span className={`portal-tag ${tag.tone}`}>{tag.label}</span><small className="portal-muted">{formatWhen(revision.decidedAt ?? revision.updatedAt)}</small></td>
                        <td className="portal-row-actions"><Link href={`${home}/revisions/${revision.id}`}>Open</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
