import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Link2, MessageSquareText } from "lucide-react";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ActivityReview, MaterialReview } from "@/components/portal/filing-review/service-actions";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { SlidingSubtabs } from "@/components/portal/sliding-subtabs";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { formatClosing } from "@/lib/applications/period";
import { requireAccess } from "@/lib/auth/session";
import { NOTICE_HOURS, activityKinds, activityStatusLabel, activityStatusTone, formatSize, materialKinds, materialStatusLabel, materialStatusTone, noticeHours } from "@/lib/candidacy/campaign";
import { reviewActivityAction, reviewMaterialAction } from "@/lib/candidacy/campaign-review-actions";
import { listActivitiesForUnit, listMaterialsForUnit, type ActivityRow, type MaterialRow } from "@/lib/candidacy/campaign-store";
import { councilOf } from "@/lib/candidacy/types";
import { formatSlot } from "@/lib/filing-portal/services";
import { isServicesMissing } from "@/lib/filing-portal/services-store";
import { fullName } from "@/lib/filing-portal/types";
import { unitName } from "@/lib/party-portal/types";
import { settle } from "@/lib/portal/settle";
import "@/components/filing-portal/documents.css";
import "@/components/portal/filing-review.css";

export const metadata: Metadata = { title: "Campaign" };

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
type Owner = MaterialRow["owner"];
/** The activity is over: there's nothing left to approve. */
const isOver = (activity: Pick<ActivityRow, "endsAt">, now = Date.now()) => Date.parse(activity.endsAt) < now;
const who = (owner: Owner) => `${fullName(owner.account)} · ${owner.position}, ${councilOf(owner.college)}${owner.partyName ? ` · ${owner.partyName}` : " · Independent"}`;

/**
 * Filing of Candidacy → Campaign: qualified candidates' campaign materials, approved before they're
 * used, and their campaign schedules, each activity approved. A Local unit sees its own college's.
 */
export default async function PortalCampaignPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAccess("candidacy/campaign");
  const local = user.affiliation === "local";
  const { view: viewParam, show } = await searchParams;
  const view = viewParam === "schedule" ? "schedule" : "materials";
  const all = show === "all";
  const scope = local ? user.college : null;
  const [materials, activities] = await Promise.all([
    settle(local && !user.college ? Promise.resolve([]) : listMaterialsForUnit(scope)),
    settle(local && !user.college ? Promise.resolve([]) : listActivitiesForUnit(scope)),
  ]);
  const error = materials.error ?? activities.error;
  const toReview = { materials: (materials.value ?? []).filter((item) => item.status === "submitted").length, schedule: (activities.value ?? []).filter((item) => item.status === "submitted" && !isOver(item)).length };
  const base = `/portal/candidacy/campaign${view === "schedule" ? "?view=schedule" : ""}`;
  const materialRows = (materials.value ?? []).filter((item) => all || item.status === "submitted");
  const activityRows = (activities.value ?? []).filter((item) => all || (item.status === "submitted" && !isOver(item)));

  return (
    <main className="portal-page is-wide fr-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Filing of Candidacy</p>
          <TitleWithInfo info="Qualified candidates send each campaign material for approval before it’s used (streamers and tarpaulins, posters, sample ballots and handbills, electronic materials, and their campaign pages), and their campaign schedule, each activity approved (Elections Code, Article VII). Sizes are checked against the Code as they’re sent. The candidate is notified and emailed each time.">Campaign</TitleWithInfo>
          <p className="portal-muted">{local ? unitName(user.college ?? "") : "Every unit’s candidates"}</p>
        </div>
        {user.readOnly && <ViewOnlyTag />}
      </header>
      <SlidingSubtabs items={[
        { key: "materials", label: <>Materials{toReview.materials > 0 && <span className="portal-tag is-gold">{toReview.materials}</span>}</>, href: "/portal/candidacy/campaign" },
        { key: "schedule", label: <>Schedule{toReview.schedule > 0 && <span className="portal-tag is-gold">{toReview.schedule}</span>}</>, href: "/portal/candidacy/campaign?view=schedule" },
      ]} active={view} label="Campaign" scope="candidacy-campaign" className="fr-subtabs" />

      {error ? <p className="portal-form-error" role="alert">{isServicesMissing(error) ? "The campaign needs a database update first: apply supabase/migrations/20261018200000_filing_services_campaign.sql, then reload." : `Couldn’t load the campaign. Reload the page. (${error})`}</p> : (
        <section className="portal-card is-flush">
          <div className="fr-tools">
            <SlidingFilters label="Show" active={all ? "all" : "review"} items={[
              { key: "review", href: base, label: <>To review <small>{view === "schedule" ? toReview.schedule : toReview.materials}</small></> },
              { key: "all", href: `${base}${base.includes("?") ? "&" : "?"}show=all`, label: <>All <small>{view === "schedule" ? (activities.value ?? []).length : (materials.value ?? []).length}</small></> },
            ]} />
          </div>
          {view === "materials" ? (
            materialRows.length ? (
              <ul className="fr-items">
                {materialRows.map((material) => (
                  <li key={material.id}>
                    <div className="fr-item-head">
                      <div>
                        <strong>{material.title}</strong>
                        <small>{materialKinds[material.kind].label}{formatSize(material) ? ` · ${formatSize(material)}` : ""}{material.showsParty ? " · Shows all the party’s candidates" : ""} · Sent {formatClosing(material.submittedAt)}</small>
                        <small><Link href={`/portal/candidacy/filings/${material.owner.id}`}>{who(material.owner)}</Link> · {material.owner.reference}{!local ? ` · ${unitName(material.owner.college)}` : ""}</small>
                      </div>
                      <span className={`portal-tag ${materialStatusTone[material.status]}`}>{material.status === "submitted" ? "To review" : materialStatusLabel[material.status]}</span>
                    </div>
                    {(material.placement || material.link) && (
                      <dl className="portal-details">
                        {material.placement && <div><dt>Where</dt><dd>{material.placement}</dd></div>}
                        {material.link && <div><dt>Address</dt><dd><a href={material.link} target="_blank" rel="noopener noreferrer nofollow"><Link2 size={13} aria-hidden="true" /> {material.link}</a></dd></div>}
                      </dl>
                    )}
                    {material.files.length > 0 && (
                      <ul className="pp-files" aria-label={`Files for ${material.title}`}>
                        {material.files.map((file, index) => <li key={file.path}><FileText size={15} aria-hidden="true" /><span className="pp-file-name"><a href={`/portal/candidacy/campaign/materials/${material.id}/files/${index}`} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{megabytes(file.size)}</small></span></li>)}
                      </ul>
                    )}
                    {material.feedback && <div className={`pp-feedback${material.status === "changes" || material.status === "declined" ? " is-changes" : ""}`}><MessageSquareText size={16} aria-hidden="true" /><div><strong>Feedback</strong><p>{material.feedback}</p>{material.reviewedAt && <small>{material.reviewedBy ? `${material.reviewedBy}, ` : ""}{formatClosing(material.reviewedAt)}</small>}</div></div>}
                    {!user.readOnly && material.owner.status === "qualified" && (
                      <MaterialReview status={material.status} approve={reviewMaterialAction.bind(null, material.id, material.updatedAt, "approved")} changes={reviewMaterialAction.bind(null, material.id, material.updatedAt, "changes")} decline={reviewMaterialAction.bind(null, material.id, material.updatedAt, "declined")} />
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="portal-empty">{all ? "No campaign materials yet. Qualified candidates send them from the filing portal." : "Nothing to review."}</p>
          ) : activityRows.length ? (
            <ul className="fr-items">
              {activityRows.map((activity: ActivityRow) => {
                const lateCancel = activity.cancelledAt && noticeHours(Date.parse(activity.cancelledAt), Date.parse(activity.startsAt)) < NOTICE_HOURS;
                const over = isOver(activity);
                return (
                  <li key={activity.id}>
                    <div className="fr-item-head">
                      <div>
                        <strong>{activity.title}</strong>
                        <small>{activityKinds[activity.kind].label} · {formatSlot(activity.startsAt, activity.endsAt)} · {activity.venue}</small>
                        <small><Link href={`/portal/candidacy/filings/${activity.owner.id}`}>{who(activity.owner)}</Link> · {activity.owner.reference}{!local ? ` · ${unitName(activity.owner.college)}` : ""}</small>
                        {activity.status === "cancelled" && <small className={lateCancel ? "fr-flag" : undefined}>Cancelled {activity.cancelledAt ? formatClosing(activity.cancelledAt) : ""}{lateCancel ? `, with less than ${NOTICE_HOURS} hours’ notice` : ""}</small>}
                      </div>
                      <span className={`portal-tag ${activityStatusTone[activity.status]}`}>{activity.status === "submitted" ? (over ? "Not reviewed, over" : "To review") : activityStatusLabel[activity.status]}</span>
                    </div>
                    {activity.details && <p className="fr-statement">{activity.details}</p>}
                    {activity.feedback && <div className={`pp-feedback${activity.status === "declined" ? " is-changes" : ""}`}><MessageSquareText size={16} aria-hidden="true" /><div><strong>Feedback</strong><p>{activity.feedback}</p></div></div>}
                    {!user.readOnly && !over && activity.status !== "cancelled" && activity.owner.status === "qualified" && (
                      <ActivityReview status={activity.status} approve={reviewActivityAction.bind(null, activity.id, activity.updatedAt, "approved")} decline={reviewActivityAction.bind(null, activity.id, activity.updatedAt, "declined")} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : <p className="portal-empty">{all ? "No campaign activities yet. Qualified candidates add them from the filing portal." : "Nothing to review."}</p>}
        </section>
      )}
    </main>
  );
}
