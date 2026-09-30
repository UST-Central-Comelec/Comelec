import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PeriodStatus, type BannerPeriod } from "@/components/apply-banner";

/**
 * Filing of Candidacy and Political Party Registration, before their forms go live: the same black
 * banner and body as Become a Commissioner (/apply). Whether each is open, and the countdown, is set
 * in the portal (PolPaR → Settings, Filing of Candidacy → Settings).
 */
export function ApplicationNotOpen({ title, eyebrow, status, description, period }: {
  title: string;
  eyebrow: string;
  /** "Filing": what the banner says is open or closed. */
  status: string;
  /** Shown while it's closed. */
  description: string;
  period: BannerPeriod;
}) {
  return (
    <main className="apply-page">
      <header className="apply-top">
        <div className="apply-top-inner">
          <div className="apply-top-title">
            <h1>{title}</h1>
          </div>
          <PeriodStatus period={period} noun={status} />
        </div>
      </header>
      <div className="apply-body apply-closed" role="status">
        <div className="apply-body-head">
          <span>{eyebrow}</span>
          {period.accepting ? (
            <>
              <h2>{status} is open</h2>
              <p>{period.closesLabel ? `Open until ${period.closesLabel}.` : "Open now."} Watch the commission’s announcements for the requirements and how to submit.</p>
            </>
          ) : (
            <>
              <h2>{status} isn’t open</h2>
              <p>{description}</p>
            </>
          )}
        </div>
        <footer className="apply-nav">
          <Link className="apply-back" href="/"><ArrowLeft size={15} /> Back to home</Link>
          <Link className="button-primary" href="/news">See announcements <ArrowRight size={15} /></Link>
        </footer>
      </div>
    </main>
  );
}
