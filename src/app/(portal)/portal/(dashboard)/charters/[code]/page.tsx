import { ViewIcon as ActionViewIcon } from "@/components/action-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenText, History, ListChecks, Settings2 } from "lucide-react";
import { EditIcon as PencilLine } from "@/components/action-icons";
import { CodeSettingsForm } from "@/components/portal/code-settings-form";
import { getCodeSettings } from "@/lib/codes/settings";
import { CodeEditor } from "@/components/portal/code-editor";
import { discardCodeRevision, saveCodeRevision } from "@/lib/portal/code-actions";
import { CodeReader } from "@/components/portal/code-reader";
import { Signers, formatWhen } from "@/components/portal/code-revision";
import { InfoTip, TitleWithInfo } from "@/components/portal/info-tip";
import { SlidingSubtabs } from "@/components/portal/sliding-subtabs";
import { Notice } from "@/components/portal/notice";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { formatClosing } from "@/lib/applications/period";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { describeStats } from "@/lib/codes/diff";
import { approverRoles, canEditCodes, codes, describeRevision, editorRoles, isCodeKey, signedCount, versionName } from "@/lib/codes/options";
import { getOpenRevision, getPublishedCode, isCodesMissing, listRevisions } from "@/lib/codes/store";
import { countSections, tidyArticles } from "@/lib/codes/text";
import { tabHref } from "@/lib/portal/access";
import { settle } from "@/lib/portal/settle";

export async function generateMetadata({ params }: PageProps<"/portal/charters/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: isCodeKey(code) ? codes[code].title : "Not found" };
}

/**
 * The Constitution or the Elections Code in the portal: the text the website shows, where it
 * stands (the version published, and any revision being written or waiting to be approved), and
 * every revision there has been. The text isn't edited here: its editors write a revision.
 */
export default async function PortalCodePage({ params, searchParams }: PageProps<"/portal/charters/[code]">) {
  const [{ code }, { notice, show }] = await Promise.all([params, searchParams]);
  if (!isCodeKey(code)) notFound();
  const { tab, title, the, path } = codes[code];
  const [user, [published, revisions, settings, draftResult]] = await withPortalUser(Promise.all([getPublishedCode(code), settle(listRevisions({ code })), settle(getCodeSettings(code)), settle(code === "magna-carta" && show !== "settings" && show !== "revisions" && show !== "changelogs" ? getOpenRevision(code) : Promise.resolve(null))]), allowed(tab));

  const home = tabHref(tab);
  const edits = !user.readOnly && canEditCodes(user);
  const all = revisions.value ?? [];
  const open = all.find((revision) => revision.status === "draft" || revision.status === "pending") ?? null;
  const view = show === "settings" ? "settings" : show === "changelogs" ? "changelogs" : show === "revisions" ? "revisions" : "text";
  const changelogs = all.filter((revision) => revision.status === "approved").sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  const visible = settings.value?.visibility === "published";
  const numbered = published.articles.filter((article) => article.numeral).length;
  const state = open ? describeRevision(open) : null;
  const inlineEditor = code === "magna-carta" && view === "text" && edits;
  const draft = draftResult.value;
  const base = draft ? draft.baseArticles : tidyArticles(published.articles);

  return (
    <main className={`portal-page${inlineEditor ? " is-wide" : ""}`}>
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Legals · Charters</p>
          <TitleWithInfo info={`The current text for the website’s ${title} page. Settings control whether it is public. It isn’t edited in place: the ${editorRoles.join(", the ")} and the Executive Associates of their offices write a revision, and the website shows it once the ${approverRoles.slice(0, -1).join(", the ")} and the ${approverRoles.at(-1)} have all approved it and the document is published in Settings.`}>{title}</TitleWithInfo>
        </div>
        {user.readOnly ? <ViewOnlyTag /> : edits && !inlineEditor && (open?.status === "pending" ? <Link className="portal-button is-ghost" href={`${home}/revisions/${open.id}`}>Open the revision</Link> : <Link className="portal-button" href={`${home}/edit`}><PencilLine size={16} aria-hidden="true" /> {open ? "Continue the draft" : "Revise"}</Link>)}
      </header>
      <Notice notice={notice} />

      {revisions.error && (
        <p className="portal-form-error" role="alert">
          {isCodesMissing(revisions.error) ? <>Revisions need a database update first. Run <code>supabase/migrations/0025_code_revisions.sql</code> in the Supabase SQL Editor, then reload. Until then the website shows {the} as it was signed.</> : <>Couldn’t load the revisions. Reload the page to try again. ({revisions.error})</>}
        </p>
      )}

      <section className="portal-card code-status" aria-label="Where it stands">
        <div>
          <p className="portal-index">On the website <InfoTip label="About the website version">
            {published.publishedAt ? `Published ${formatClosing(published.publishedAt)}.` : "No revision has been approved in the portal yet."} {numbered} {numbered === 1 ? "article" : "articles"}, {countSections(published.articles)} sections. {visible && <a href={path} target="_blank" rel="noreferrer">View on website <ActionViewIcon size={13} aria-hidden="true" /></a>}
          </InfoTip></p>
          <strong className="code-publication-status">{settings.error ? "Visibility unavailable" : visible ? "Published" : "Hidden"} · {published.articles.length ? versionName(published.version) : "Empty document"}</strong>
          <p className="portal-muted">Last published: {published.publishedAt ? <time dateTime={published.publishedAt}>{formatClosing(published.publishedAt)}</time> : "Not recorded"}</p>
        </div>
        <div className={open?.status === "pending" ? "is-pending" : undefined}>
          <p className="portal-index">Revision <InfoTip label="About revisions">
            A revision is written by the {editorRoles.join(" or the ")}, or their offices, and approved by the {approverRoles.slice(0, -1).join(", the ")} and the {approverRoles.at(-1)}.
            {!open && edits && ` Revise ${the} to start one. Nothing changes on the website until it’s approved.`}
          </InfoTip></p>
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
            <strong>None in progress</strong>
          )}
        </div>
      </section>

      <SlidingSubtabs active={view} label={title} scope={`codes:${code}`} items={[
        { key: "text", href: home, label: <><BookOpenText size={15} strokeWidth={1.8} aria-hidden="true" /> The text</> },
        { key: "revisions", href: `${home}?show=revisions`, label: <><History size={15} strokeWidth={1.8} aria-hidden="true" /> Revisions{all.length > 0 && <span className="portal-tag">{all.length}</span>}</> },
        { key: "changelogs", href: `${home}?show=changelogs`, label: <><ListChecks size={15} strokeWidth={1.8} aria-hidden="true" /> Changelogs{changelogs.length > 0 && <span className="portal-tag">{changelogs.length}</span>}</> },
        { key: "settings", href: `${home}?show=settings`, label: <><Settings2 size={15} strokeWidth={1.8} aria-hidden="true" /> Settings</> },
      ]} />

      {view === "settings" ? (
        <section className="portal-card">
          <h2>Publication settings</h2>
          {settings.error ? <p className="portal-form-error" role="alert">Couldn’t load the settings. Apply <code>supabase/migrations/0049_code_settings.sql</code>, then reload.</p> : settings.value && <CodeSettingsForm key={`${code}:${settings.value.visibility}`} code={code} visibility={settings.value.visibility} readOnly={user.readOnly} />}
        </section>
      ) : view === "changelogs" ? (
        <section className="portal-card" aria-labelledby="code-changelogs-title">
          <header className="portal-card-head">
            <TitleWithInfo as="h2" className="portal-card-title" id="code-changelogs-title" info="Approved document versions, newest first, with the editors’ notes and a link to the detailed changes. Versions remain here while the document is hidden.">Changelogs</TitleWithInfo>
          </header>
          {revisions.error ? (
            <p className="portal-empty">Changelogs couldn’t be loaded. Resolve the error above, then reload.</p>
          ) : changelogs.length === 0 ? (
            <p className="portal-empty">No changelogs yet. Approved revisions will appear here.</p>
          ) : (
            <ol className="code-history">
              {changelogs.map((revision) => (
                <li key={revision.id} className="is-ok">
                  <strong><Link href={`${home}/revisions/${revision.id}`}>{versionName(revision.version ?? 0)}</Link></strong>
                  <small>Approved {formatWhen(revision.decidedAt ?? revision.updatedAt)} · Written by {revision.author.name}{revision.author.role && `, ${revision.author.role}`}</small>
                  <small>{describeStats(revision.stats)}</small>
                  {revision.summary && <blockquote>{revision.summary}</blockquote>}
                  <Link href={`${home}/revisions/${revision.id}`}><ActionViewIcon size={15} aria-hidden="true" />View changes</Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : view === "text" ? (
        inlineEditor ? (
          draftResult.error ? (
            <p className="portal-form-error" role="alert">Couldn’t load the draft. Reload before editing. If the database needs an update, apply <code>supabase/migrations/0049_code_settings.sql</code>.</p>
          ) : draft?.status === "pending" ? (
            <>
              <section className="portal-card"><p className="portal-muted">The revision is waiting for approval. <Link href={`${home}/revisions/${draft.id}`}>Open the revision</Link> to review it or withdraw it for editing.</p></section>
              {published.articles.length > 0 ? <CodeReader articles={published.articles} /> : <section className="portal-card"><p className="portal-empty">No approved contents yet.</p></section>}
            </>
          ) : (
            <>
              <section className="portal-card">
                <TitleWithInfo as="h2" className="portal-card-title" info="Build the document with an optional preamble, numbered articles, sections and paragraph lists. These controls create blank parts; use the headings and numbering from your source document. Save a draft, then send it for approval. The public text changes after approval.">Edit the text</TitleWithInfo>
                {draft?.returned && <p className="portal-muted">Sent back by the {draft.returned.role}: {draft.returned.note}</p>}
              </section>
              <CodeEditor
                key={draft?.id ?? "new-magna-carta"}
                code={code}
                base={base}
                initial={draft ? draft.articles : base}
                draft={draft ? { id: draft.id, edits: draft.edits, at: draft.updatedAt } : null}
                note={draft?.summary ?? ""}
                save={saveCodeRevision.bind(null, code)}
                discard={discardCodeRevision.bind(null, code)}
              />
            </>
          )
        ) : published.articles.length ? <CodeReader articles={published.articles} /> : <section className="portal-card"><p className="portal-empty">No contents yet.</p></section>
      ) : (
        <section className="portal-card is-flush">
          {all.length === 0 ? (
            <p className="portal-empty">No revisions yet.{published.articles.length > 0 ? ` The current text is ${the} as it was signed.` : " The document is empty."}</p>
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
