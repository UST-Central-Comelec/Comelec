"use client";
import { formatClosing } from "@/lib/applications/period";
import type { Survey } from "@/lib/surveys/types";
import { PeriodOverview } from "./period-overview";

/** A survey has no closing time; it opens and closes when someone changes its status in Details. */
export function SurveyOverview({ survey }: { survey: Pick<Survey, "status" | "responseCount" | "updatedAt" | "updatedBy"> }) {
  const count = `${survey.responseCount} ${survey.responseCount === 1 ? "response" : "responses"} so far`;
  const headlines = { draft: "Draft, not yet open", open: "Accepting responses", closed: "Responses closed" };
  const details = {
    draft: "Members can’t see this survey. Set it to Open in Details when the questions are ready.",
    open: `${count}. Each member answers once. Close it in Details to stop new responses.`,
    closed: `${count}. Set it to Open in Details to take responses again.`,
  };
  return <div className="portal-event-overview">
    <PeriodOverview
      label="Survey status"
      state={survey.status === "open" ? "open" : "closed"}
      headline={headlines[survey.status]}
      detail={details[survey.status]}
      closesAt={null}
      updated={Number.isFinite(Date.parse(survey.updatedAt)) ? `Last changed by ${survey.updatedBy} · ${formatClosing(survey.updatedAt)}` : null}
    />
  </div>;
}
