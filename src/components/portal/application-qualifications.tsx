import type { ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { ApplicationRecord } from "@/lib/applications/admin";
import { conflicts, qualifications, type ConflictId, type QualificationField } from "@/lib/applications/options";

function QualificationAnswer({ question, good = true, children }: { question: string; good?: boolean; children: ReactNode }) {
  return (
    <details className={`portal-qualification-answer ${good ? "is-good" : "is-conflict"}`} open={!good}>
      <summary>
        <span className="portal-qualification-mark" role="img" aria-label={good ? "Requirement satisfied" : "Conflict declared"}>
          {good ? <Check size={17} aria-hidden="true" /> : <X size={17} aria-hidden="true" />}
        </span>
        <span className="portal-qualification-question">{question}</span>
        <ChevronDown className="portal-qualification-chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="portal-qualification-content">{children}</div>
    </details>
  );
}

export function ApplicationQualifications({ declared }: { declared: ApplicationRecord["conflicts"] }) {
  if (!declared) return <p className="portal-muted">Not asked. This application was sent before the form covered qualifications.</p>;
  return (
    <div className="portal-qualification-answers">
      <QualificationAnswer question="Bona fide student of the faculty, college, school or institute you’ll serve.">
        <p>Verified with UST Google</p>
      </QualificationAnswer>
      {(Object.keys(qualifications) as QualificationField[]).map((field) => (
        <QualificationAnswer key={field} question={qualifications[field]}><p>Confirmed</p></QualificationAnswer>
      ))}
      {(Object.keys(conflicts) as ConflictId[]).map((type) => {
        const conflict = declared.find((item) => item.type === type);
        return (
          <QualificationAnswer key={type} question={conflicts[type].question} good={!conflict}>
            {conflict ? <>
              <p><strong>Yes — to resolve before taking office</strong></p>
              <p>{conflicts[type].detailLabel} <strong>{conflict.detail}</strong></p>
              <p>{conflicts[type].resolve}</p>
            </> : <p>No conflict declared</p>}
          </QualificationAnswer>
        );
      })}
      <QualificationAnswer question="Should I be appointed, I will step down from the office or end the affiliation I named above before my term begins, and remain apart from it while I serve. I understand my appointment depends on this.">
        <p>{declared.length > 0 ? "Confirmed" : "Not applicable — no conflicts declared"}</p>
      </QualificationAnswer>
    </div>
  );
}
