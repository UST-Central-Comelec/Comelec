import type { EventAnalytics, Tally } from "@/lib/events/analytics";
import { TitleWithInfo } from "./info-tip";

// How an event's sign-ups answered the form, on its page in the portal. Styled in portal.css
// (.portal-analytics): the bars' gold and the interest scale's five steps are set there.

/** How many answers a list shows before the rest fold away behind a line that opens. */
const TOP = 8;

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** A share as a whole percentage; anything real but under half a percent says so instead of "0%". */
const percent = (share: number) => (share > 0 && share < 0.005 ? "<1%" : `${Math.round(share * 100)}%`);

function BarRows({ rows, max }: { rows: Tally[]; max: number }) {
  return (
    <ol className="portal-bars">
      {rows.map((row) => (
        <li key={row.label}>
          <span className="portal-bar-label" title={row.label}>{row.label}</span>
          <span className="portal-bar-value"><b>{row.count}</b>{percent(row.share)}</span>
          <span className="portal-bar-track" aria-hidden="true"><i style={{ width: `${max ? (row.count / max) * 100 : 0}%` }} /></span>
        </li>
      ))}
    </ol>
  );
}

/**
 * One question's answers as a bar list: how many gave each, on one scale (the longest bar is the
 * most common answer). `rows` come in the order to show them. With `fold`, a long list shows its
 * first TOP answers, and the rest sit behind a line that says how many they are and opens to list
 * them: `fold` names what's being counted ("college").
 */
function BarChart({ title, rows, note, fold, wide, empty }: { title: string; rows: Tally[]; note?: string; fold?: string; wide?: boolean; empty?: string }) {
  const max = Math.max(0, ...rows.map((row) => row.count));
  // One answer left over isn't worth hiding.
  const folds = fold && rows.length > TOP + 1;
  const top = folds ? rows.slice(0, TOP) : rows;
  const rest = folds ? rows.slice(TOP) : [];

  return (
    <figure className={`portal-chart${wide ? " is-wide" : ""}`}>
      <figcaption><strong>{title}</strong>{note && <span>{note}</span>}</figcaption>
      {rows.length === 0 ? (
        <p className="portal-muted">{empty ?? "No answers yet."}</p>
      ) : (
        <>
          <BarRows rows={top} max={max} />
          {fold && rest.length > 0 && (
            <details>
              <summary>
                <span>{plural(rest.length, `other ${fold}`)}</span>
                <span className="portal-bar-value"><b>{rest.reduce((sum, row) => sum + row.count, 0)}</b>{percent(rest.reduce((sum, row) => sum + row.share, 0))}</span>
              </summary>
              <BarRows rows={rest} max={max} />
            </details>
          )}
        </>
      )}
    </figure>
  );
}

export function EventAnalyticsView({ analytics }: { analytics: EventAnalytics }) {
  const { total, registered, waitlisted, averageInterest, interest } = analytics;
  const answered = interest.filter((level) => level.count > 0);
  const keen = interest.filter((level) => level.value >= 4).reduce((sum, level) => sum + level.share, 0);

  return (
    <section className="portal-card portal-analytics portal-event-section" id="analytics" aria-labelledby="analytics-title">
      <header className="portal-card-head">
        <TitleWithInfo as="h2" className="portal-card-title" id="analytics-title" info="How everyone who signed up answered the registration form, whether they registered or joined the waitlist. Shares are out of everyone who signed up.">Analytics</TitleWithInfo>
        <span className="portal-index">{plural(total, "sign-up")}</span>
      </header>

      {total === 0 ? (
        <p className="portal-empty">Nothing to chart yet. Once people sign up, their answers are summed up here.</p>
      ) : (
        <>
          <dl className="portal-kpis">
            <div className="is-lead"><dt>Signed up</dt><dd>{total}</dd></div>
            <div><dt>Registered</dt><dd>{registered}</dd></div>
            <div><dt>On the waitlist</dt><dd>{waitlisted}</dd></div>
            <div><dt>Average interest</dt><dd>{averageInterest === null ? "–" : averageInterest.toFixed(1)}<small>out of 5</small></dd></div>
            <div><dt>Colleges represented</dt><dd>{analytics.colleges.length}</dd></div>
          </dl>

          <div className="portal-charts">
            <figure className="portal-chart is-wide">
              <figcaption><strong>Interest level</strong><span>{percent(keen)} very or extremely interested</span></figcaption>
              {/* One bar split by answer, lowest to highest. The legend underneath carries every number. */}
              <div className="portal-likert" role="img" aria-label={`Interest level: ${interest.map((level) => `${level.label} ${percent(level.share)}`).join(", ")}`}>
                {answered.map((level) => (
                  <span key={level.value} className={`portal-level-${level.value}`} style={{ flexGrow: level.count, flexBasis: 0 }}>
                    <span className="portal-chart-tip"><b>{level.count}</b>{level.label} · {percent(level.share)}</span>
                  </span>
                ))}
              </div>
              <ol className="portal-likert-legend">
                {interest.map((level) => (
                  <li key={level.value} className={`portal-level-${level.value}`}>
                    <i aria-hidden="true" />
                    <span>{level.value} · {level.label}</span>
                    <b>{level.count}<small>{percent(level.share)}</small></b>
                  </li>
                ))}
              </ol>
            </figure>

            <BarChart title="College or faculty" rows={analytics.colleges} note={plural(analytics.colleges.length, "college")} fold="college" />
            <BarChart title="Program" rows={analytics.programs} note={plural(analytics.programs.length, "program")} fold="program" />
            <BarChart title="Year level" rows={analytics.yearLevels} />
            <BarChart title="Sex" rows={analytics.sex} />
            <BarChart
              title="Organization affiliation"
              rows={analytics.organizations}
              note={`${plural(analytics.organizations.length, "organization")} · ${analytics.unaffiliated} listed none`}
              fold="organization"
              empty="Nobody listed an organization."
              wide
            />
          </div>
        </>
      )}
    </section>
  );
}
