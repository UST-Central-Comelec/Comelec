import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PeriodStatus, type BannerPeriod } from "@/components/apply-banner";
import { FACEBOOK_PAGE } from "@/lib/content";

/** Where the requirements and the latest updates go up first. */
const followUs = <>For the requirements, how to submit and the latest updates, follow the <a href={FACEBOOK_PAGE} target="_blank" rel="noreferrer">Central Comelec’s Facebook page</a>.</>;

/**
 * Filing of Candidacy and Political Party Registration, before their forms go live: the same black
 * banner and body as Become a Commissioner (/apply). Every unit opens and closes its own in the
 * portal (PolPaR → Settings, Filing of Candidacy → Settings): the banner says whether any unit is
 * open, and the body names the ones that are.
 */
export function ApplicationNotOpen({ title, eyebrow, status, description, period, units = [] }: {
  title: string;
  eyebrow: string;
  /** "Filing": what the banner says is open or closed. */
  status: string;
  /** Shown while it's closed. */
  description: string;
  period: BannerPeriod;
  /** The units that are open right now, the Central Comelec first, each with when it closes ("October 29, 2026, 11:59 PM"; null with no closing date). */
  units?: Array<{ name: string; closes: string | null; /** The unit the visitor came for, from the Events page. */ picked?: boolean }>;
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
              <p>{units.length > 0 ? "Each unit of the commission opens its own. These are open now:" : period.closesLabel ? `Open until ${period.closesLabel}.` : "Open now."} {units.length === 0 && followUs}</p>
              {units.length > 0 && (
                <>
                  <ul className="apply-units">
                    {units.map((unit) => (
                      <li key={unit.name} className={unit.picked ? "is-picked" : undefined}><strong>{unit.name}</strong><span>{unit.closes ? `Open until ${unit.closes}` : "Open, with no closing date"}</span></li>
                    ))}
                  </ul>
                  <p>{followUs}</p>
                </>
              )}
            </>
          ) : (
            <>
              <h2>{status} isn’t open</h2>
              <p>{description}</p>
              <p>{followUs}</p>
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
