import type { Metadata } from "next";
import { ScheduleBoard } from "@/components/filing-portal/campaign";
import { CandidacyHead } from "@/components/filing-portal/page-heads";
import type { CalendarHighlight } from "@/lib/calendar/options";
import { campaignOpen, canChangeActivity, hasNotice } from "@/lib/candidacy/campaign";
import { listActivities, moratoriumDays } from "@/lib/candidacy/campaign-store";
import { listCandidacyDocuments } from "@/lib/candidacy/store";
import { isServicesMissing } from "@/lib/filing-portal/services-store";
import { requireCandidacy } from "@/lib/filing-portal/session";
import { unitName } from "@/lib/party-portal/types";
import { settle } from "@/lib/portal/settle";
import { CampaignClosed } from "../campaign-closed";

export const metadata: Metadata = { title: "Campaign schedule" };

/** Candidacy → Campaign schedule: where and when the candidate campaigns, each activity approved by the unit. */
export default async function CampaignSchedulePage() {
  const { candidacy } = await requireCandidacy();
  const [documents, activities, banned] = await Promise.all([listCandidacyDocuments(candidacy.id), settle(listActivities(candidacy.id)), moratoriumDays(candidacy.college)]);
  const list = activities.value ?? [];
  const open = campaignOpen(candidacy);
  const moratoriums: CalendarHighlight[] = banned.map((day, index) => ({ id: `moratorium-${index}`, start: day.start, end: day.end, kind: "moratorium", color: null, label: day.label || "No-campaign day", author: "", shared: true, updatedAt: "" }));

  return (
    <main className="portal-page">
      <CandidacyHead candidacy={candidacy} documents={documents} current="schedule" />
      {activities.error ? (
        <p className="portal-form-error" role="alert">{isServicesMissing(activities.error) ? "The campaign schedule isn’t set up yet. Try again later." : "Your schedule couldn’t be loaded. Reload the page to try again."}</p>
      ) : (
        <>
          {!open && <CampaignClosed candidacy={candidacy} />}
          {(open || list.length > 0) && <ScheduleBoard open={open} activities={list} changeable={list.filter((activity) => canChangeActivity(activity) && hasNotice(activity.startsAt)).map((activity) => activity.id)} cancellable={list.filter((activity) => canChangeActivity(activity)).map((activity) => activity.id)} moratoriums={moratoriums} unit={unitName(candidacy.college)} />}
        </>
      )}
    </main>
  );
}
