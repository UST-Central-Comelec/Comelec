import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/session";
import { stampFor } from "@/lib/data/edit-guard";
import { getSurvey, surveyResponses } from "@/lib/surveys/store";
import { surveyNumber, surveySchema, type Survey, type SurveyResponse } from "@/lib/surveys/types";
import type { EditGuardInfo } from "@/lib/portal/edit-conflict";
import { ViewIcon } from "@/components/action-icons";
import { SlidingSubtabs } from "./sliding-subtabs";
import { ViewOnlyTag } from "./view-only";
import { SurveyCopyLink } from "./survey-copy-link";
import { SurveyOverview } from "./survey-overview";
import { SurveyEditor } from "./survey-editor";
import { SurveyResponses } from "./survey-responses";

export type SurveyTab = "details" | "responses" | "form";

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

/** One survey in the portal, laid out like an event: its details, who answered, and its questions. */
export async function SurveyDetailPage({ id, tab }: { id: string; tab: SurveyTab }) {
  const user = await requireAccess("secretariat/surveys");
  const survey = await getSurvey(id, user);
  if (!survey) notFound();
  const responses = tab === "responses" ? await surveyResponses(survey) : [];
  const guard = user.readOnly ? undefined : { stamp: stampFor(survey.updatedAt, surveySchema.parse(survey)), record: `secretariat_surveys/${survey.id}` };
  return <SurveyDetailView survey={survey} responses={responses} tab={tab} readOnly={user.readOnly} guard={guard} />;
}

export function SurveyDetailView({ survey, responses, tab, readOnly, guard }: { survey: Survey; responses: SurveyResponse[]; tab: SurveyTab; readOnly: boolean; guard?: EditGuardInfo }) {
  const base = `/portal/secretariat/surveys/${survey.id}`;
  return <main className="portal-page is-wide portal-survey-page">
    <header className="portal-page-head">
      <div>
        <Link className="portal-back" href="/portal/secretariat/surveys">← Surveys</Link>
        <h1>{survey.title}</h1>
        <p className="portal-muted">{surveyNumber(survey)}</p>
      </div>
      <div className="portal-head-actions">
        {readOnly && <ViewOnlyTag />}
        {survey.status === "open" && <>
          <SurveyCopyLink path={`${base}/answer`} />
          <Link className="portal-button is-ghost" href={`${base}/answer`}><ViewIcon size={15} aria-hidden="true" />Answer survey</Link>
        </>}
      </div>
    </header>

    <SurveyOverview survey={survey} />

    <SlidingSubtabs active={tab} label="Survey sections" scope={`survey:${survey.id}`} className="event-detail-tabs" items={[
      { key: "details", href: base, label: "Details" },
      { key: "responses", href: `${base}/responses`, label: `Responses (${survey.responseCount})` },
      { key: "form", href: `${base}/form`, label: "Form editor" },
    ]} />

    {tab === "details" && <div className="portal-survey-details">
      <SurveyEditor key={survey.updatedAt} initial={survey} section="details" readOnly={readOnly} guard={guard} />
      <section className="portal-card" aria-labelledby="survey-record-title">
        <header className="portal-card-head"><h2 className="portal-card-title" id="survey-record-title">Record</h2></header>
        <dl className="portal-details">
          <div><dt>Control number</dt><dd>{surveyNumber(survey)}</dd></div>
          <div><dt>Status</dt><dd><span className={`portal-tag${survey.status === "open" ? " is-ok" : ""}`}>{survey.status === "open" ? "Open" : survey.status === "closed" ? "Closed" : "Draft"}</span></dd></div>
          <div><dt>Responses</dt><dd>{survey.responseCount}</dd></div>
          <div><dt>Questions</dt><dd>{survey.definition.steps.flatMap(step => step.fields).filter(field => !["content", "image"].includes(field.kind)).length}</dd></div>
          <div><dt>Unit</dt><dd>{survey.college ?? "Central Comelec"}</dd></div>
          <div><dt>Created</dt><dd>{formatWhen(survey.createdAt)}</dd></div>
          <div><dt>Created by</dt><dd>{survey.createdBy}</dd></div>
          <div><dt>Last updated</dt><dd>{formatWhen(survey.updatedAt)}</dd></div>
          <div><dt>Last updated by</dt><dd>{survey.updatedBy}</dd></div>
        </dl>
      </section>
    </div>}
    {tab === "responses" && <SurveyResponses responses={responses} />}
    {tab === "form" && <SurveyEditor key={survey.updatedAt} initial={survey} section="form" readOnly={readOnly} guard={guard} />}
  </main>;
}
