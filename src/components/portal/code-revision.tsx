import Link from "next/link";
import { ArrowUpRight, Check, CircleDashed, PencilLine } from "lucide-react";
import { formatClosing } from "@/lib/applications/period";
import { canOpen, type PortalUser } from "@/lib/auth/session";
import { describeStats, diffArticles } from "@/lib/codes/diff";
import { approverRoleOf, approverRoles, awaitedRoles, canEditCodes, codes, describeRevision, versionName, type ApproverRole, type CodeRevision, type RevisionEventKind, type RevisionSummary } from "@/lib/codes/options";
import { properName } from "@/lib/data/accounts";
import { tabHref } from "@/lib/portal/access";
import { approveCodeRevision, returnCodeRevision, withdrawCodeRevision, type ReviewPlace } from "@/lib/portal/code-actions";
import { CodeChanges } from "./code-changes";
import { CodeDecision } from "./code-decision";
import { CodeReader } from "./code-reader";
import { DeleteButton } from "./delete-button";
import { TitleWithInfo } from "./info-tip";
import { Notice } from "./notice";
import { SlidingFilters } from "./sliding-filters";

const when = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

/** "Oct 2, 2026, 3:10 PM", in Manila. */
export const formatWhen = (iso: string) => when.format(new Date(iso));

/** Who holds each of the three offices that sign, for saying who a revision is waiting on. */
export type Holders = Partial<Record<ApproverRole, string[]>>;

/**
 * The three signatures a revision needs, each signed or still missing. `holders` names who a
 * missing one is waiting on; `compact` is the row of marks a list shows.
 */
export function Signers({ revision, holders, compact }: { revision: Pick<RevisionSummary, "approvals" | "status">; holders?: Holders; compact?: boolean }) {
  if (compact) {
    return (
      <span className="code-signer-marks">
        {approverRoles.map((role) => {
          const signature = revision.approvals[role];
          return <i key={role} className={signature ? "is-signed" : undefined} title={signature ? `${role}: approved by ${signature.name}` : `${role}: not yet`}>{signature && <Check size={10} strokeWidth={3} aria-hidden="true" />}<span className="portal-visually-hidden">{role}: {signature ? "approved" : "not yet"}</span></i>;
        })}
      </span>
    );
  }
  const waiting = revision.status === "pending";
  return (
    <ol className="code-signers">
      {approverRoles.map((role) => {
        const signature = revision.approvals[role];
        const names = holders?.[role] ?? [];
        return (
          <li key={role} className={signature ? "is-signed" : waiting ? "is-waiting" : undefined}>
            <span className="code-signer-mark" aria-hidden="true">{signature ? <Check size={13} strokeWidth={2.6} /> : <CircleDashed size={14} />}</span>
            <span>
              <strong>{role}</strong>
              <small>
                {signature ? `Approved by ${signature.name} · ${formatWhen(signature.at)}` : !waiting ? "Not asked yet" : names.length ? `Waiting for ${names.map(properName).join(" or ")}` : "No active account holds this office, so it can’t be approved yet"}
              </small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const happened: Record<RevisionEventKind, string> = {
  submitted: "Sent for approval",
  approved: "Approved",
  returned: "Sent back for changes",
  withdrawn: "Withdrawn from approval",
  published: "Published on the website",
  discarded: "Discarded",
};

/** A revision's history, oldest first: who started it, and each time it was sent, signed, sent back, withdrawn or published. */
function History({ revision }: { revision: RevisionSummary }) {
  const steps = [{ at: revision.createdAt, label: "Draft started", by: `${revision.author.name}${revision.author.role ? `, ${revision.author.role}` : ""}`, tone: "", note: "" }, ...revision.events.map((event) => ({ at: event.at, label: happened[event.action], by: event.action === "published" ? "" : `${event.name}${event.role ? `, ${event.role}` : ""}`, tone: event.action === "returned" ? "is-warn" : event.action === "approved" || event.action === "published" ? "is-ok" : "", note: event.note ?? "" }))];
  return (
    <ol className="code-history">
      {steps.map((step, index) => (
        <li key={index} className={step.tone || undefined}>
          <strong>{step.label}</strong>
          <small>{[step.by, formatWhen(step.at)].filter(Boolean).join(" · ")}</small>
          {step.note && <blockquote>{step.note}</blockquote>}
        </li>
      ))}
    </ol>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

type Props = {
  revision: CodeRevision;
  user: PortalUser;
  holders: Holders;
  /** Which tab it's being read under: Approvals, or the text's own. */
  place: ReviewPlace;
  notice?: string | string[];
  /** "text" shows the whole text as proposed instead of what it changes. */
  show?: string | string[];
};

/**
 * One revision of the Constitution or the Elections Code: what it changes (or the whole text as
 * proposed), who has approved it, and its history. Its editors can pick the draft up again or
 * withdraw it from approval here; the three who sign approve it or send it back.
 */
export function RevisionView({ revision, user, holders, place, notice, show }: Props) {
  const { title, the, tab, path } = codes[revision.code];
  const here = place === "approvals" ? `/portal/apps/approvals/${revision.id}` : `${tabHref(tab)}/revisions/${revision.id}`;
  const state = describeRevision(revision);
  const draft = revision.status === "draft";
  const pending = revision.status === "pending";
  const edits = !user.readOnly && canEditCodes(user);
  // Signing happens under Approvals, which only the Central Executive Board has.
  const office = !user.readOnly && canOpen(user, "apps/approvals") ? approverRoleOf(user) : null;
  const awaited = awaitedRoles(revision);
  const diff = diffArticles(revision.baseArticles, revision.articles);
  const view = show === "text" ? "text" : "changes";

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href={place === "approvals" ? tabHref("apps/approvals") : `${tabHref(tab)}?show=revisions`}>← {place === "approvals" ? "Approvals" : title}</Link>
          <p className="portal-eyebrow">{title}</p>
          <h1>{revision.status === "approved" && revision.version ? `Version ${revision.version}` : "Revision"} of {the}</h1>
          <p className="portal-muted">Written against {revision.baseVersion > 0 ? `version ${revision.baseVersion}` : "the text as signed"} · {describeStats(revision.stats)}</p>
        </div>
        <div className="portal-head-actions">
          <span className={`portal-tag portal-status-tag ${state.tone}`}>{state.label}</span>
          {revision.status === "approved" && <a className="portal-button is-ghost" href={path} target="_blank" rel="noreferrer">View on website <ArrowUpRight size={15} aria-hidden="true" /></a>}
          {edits && pending && <DeleteButton tone="quiet" action={withdrawCodeRevision.bind(null, revision.code, revision.id)} label="Withdraw" prompt="Withdraw it from approval? Any approvals so far are cleared." confirmLabel="Yes, withdraw" pendingLabel="Withdrawing…" />}
          {edits && draft && <Link className="portal-button" href={`${tabHref(tab)}/edit`}><PencilLine size={15} aria-hidden="true" /> Continue editing</Link>}
        </div>
      </header>
      <Notice notice={notice} />

      {draft && revision.returned && (
        <section className="portal-card portal-event-request is-pending" aria-label="Sent back for changes">
          <p className="portal-eyebrow">Sent back for changes by the {revision.returned.role}</p>
          <blockquote className="portal-request-text">{revision.returned.note}</blockquote>
          <p className="portal-muted">{revision.returned.name} · {formatClosing(revision.returned.at)}. It’s a draft again until it’s sent for approval once more.</p>
        </section>
      )}

      <div className="code-review">
        <div className="code-review-main">
          <section className="portal-card" aria-labelledby="revision-note-title">
            <h2 className="portal-card-title" id="revision-note-title">What changed, and why</h2>
            {revision.summary ? <blockquote className="portal-request-text">{revision.summary}</blockquote> : <p className="portal-empty">Nothing written yet. The editors add this before sending it for approval.</p>}
          </section>

          <SlidingFilters label="Show" active={view} items={[{ key: "changes", href: here, label: "What it changes" }, { key: "text", href: `${here}?show=text`, label: "The whole text, as proposed" }]} />

          {view === "text" ? <CodeReader articles={revision.articles} rail={false} /> : <section className="portal-card code-changes-card" aria-label="What it changes"><CodeChanges diff={diff} /></section>}
        </div>

        <aside className="code-review-side">
          <section className={`portal-card code-approvals${pending ? " is-pending" : ""}`} aria-labelledby="revision-approvals-title">
            <header className="portal-card-head">
              <TitleWithInfo as="h2" className="portal-card-title" id="revision-approvals-title" info={`A revision is published once the ${approverRoles.slice(0, -1).join(", the ")} and the ${approverRoles.at(-1)} of the Central Comelec have all approved it. Any of them can send it back for changes instead, which clears the approvals so far.`}>Approvals</TitleWithInfo>
              <Signers revision={revision} compact />
            </header>
            {revision.status === "discarded" ? <p className="portal-empty">Discarded before it was approved.</p> : <Signers revision={revision} holders={holders} />}
            {pending && office && (
              <CodeDecision role={office} signed={Boolean(revision.approvals[office])} last={awaited.length === 1 && awaited[0] === office} approve={approveCodeRevision.bind(null, revision.id, place)} sendBack={returnCodeRevision.bind(null, revision.id, place)} />
            )}
            {pending && !office && <p className="portal-muted code-approvals-note">{edits ? "Its text is locked while it waits. Withdraw it to keep editing." : "Only the three offices above approve a revision or send it back."}</p>}
          </section>

          <section className="portal-card" aria-labelledby="revision-details-title">
            <h2 className="portal-card-title" id="revision-details-title">Details</h2>
            <dl className="portal-details">
              <Detail label="Text">{title}</Detail>
              <Detail label="Written against">{versionName(revision.baseVersion)}</Detail>
              <Detail label="Started by">{revision.author.name}<small className="portal-muted email-detail-note">{[revision.author.role, revision.author.email].filter(Boolean).join(" · ")}</small></Detail>
              {revision.submitted && <Detail label="Sent by">{revision.submitted.name}<small className="portal-muted email-detail-note">{formatClosing(revision.submitted.at)}</small></Detail>}
              {revision.decidedAt ? <Detail label={revision.status === "approved" ? "Published" : "Discarded"}>{formatClosing(revision.decidedAt)}</Detail> : <Detail label="Last saved">{formatClosing(revision.updatedAt)}<small className="portal-muted email-detail-note">{revision.updatedBy}</small></Detail>}
            </dl>
          </section>

          <section className="portal-card" aria-labelledby="revision-history-title">
            <h2 className="portal-card-title" id="revision-history-title">History</h2>
            <History revision={revision} />
          </section>
        </aside>
      </div>
    </main>
  );
}
