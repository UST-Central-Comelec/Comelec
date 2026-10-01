import type { Metadata } from "next";
import { Download } from "lucide-react";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { CopyLink } from "@/components/news/copy-link";
import { formatShort, plural } from "@/components/news/story";
import { PageBanner } from "@/components/page-banner";
import { StatTable } from "@/components/statistics/stat-table";
import { getStatisticsForSite } from "@/lib/statistics/queries";
import { byPeriod, type StatisticTable } from "@/lib/statistics/table";
import "../banner-page.css";
import "./statistics.css";

export const metadata: Metadata = {
  title: "Statistics",
  description: "Election figures published by the UST Central Comelec, as tables you can read online or download.",
};

// Rebuilt at most once a minute (saving a table in the portal also rebuilds the page straight away).
export const revalidate = 60;

const two = (value: number) => String(value).padStart(2, "0");

/** One table: what it is and when it's as of, its figures, and where they come from. */
function TableCard({ table }: { table: StatisticTable }) {
  return (
    <article className="st-card" id={table.id} aria-labelledby={`${table.id}-title`}>
      <header className="st-card-head">
        <div className="st-card-what">
          <h3 className="st-card-title" id={`${table.id}-title`}>{table.title}</h3>
          <p className="st-card-meta">
            <span>As of <time dateTime={table.asOf}>{formatShort(table.asOf)}</time></span>
            <span>{plural(table.rows.length, "row")}</span>
          </p>
        </div>
        <div className="st-card-actions">
          <a className="bp-button is-ghost is-small" href={`/statistics/${table.id}/csv`} download={`${table.id}.csv`}><Download size={15} aria-hidden="true" />Download CSV</a>
          <CopyLink className="bp-button is-ghost is-small" hash={table.id} />
        </div>
      </header>
      {table.summary && <p className="st-card-summary">{table.summary}</p>}
      {/* Wide tables scroll sideways inside the card; focusable, so the keyboard can scroll them too. */}
      <div className="st-table-wrap" role="region" aria-label={`${table.title}: table`} tabIndex={0}>
        <StatTable prefix="st" table={table} barColumn={table.barColumn} showTotal={table.showTotal} label={table.title} />
      </div>
      {table.note && <p className="st-note"><b>Note</b>{table.note}</p>}
    </article>
  );
}

export default async function StatisticsPage() {
  // Every table, the most recent figures first, under the election or period each belongs to.
  const tables = await getStatisticsForSite();
  const groups = byPeriod(tables);

  return (
    <main className="bp st">
      <RevealOnScroll />
      <PageBanner
        seed={1953}
        eyebrow="By the numbers"
        title={<>Election <em>statistics.</em></>}
        lede="Figures published by the commission, as tables you can read here or download."
        readings={[
          { label: "Tables", value: two(tables.length) },
          { label: "Latest figures", value: tables.length ? formatShort(tables[0].asOf) : "None yet" },
        ]}
      />

      <div className="bp-wrap">
        {groups.length > 0 ? (
          <div className="st-layout">
            <div className="st-main">
              {groups.map((group) => (
                <section className="st-group" key={group.period} id={group.anchor} aria-labelledby={`${group.anchor}-title`}>
                  <header className="bp-head">
                    <h2 id={`${group.anchor}-title`}>{group.period}</h2>
                    <i aria-hidden="true" />
                    <p>{plural(group.tables.length, "table")}</p>
                  </header>
                  {group.tables.map((table) => <TableCard key={table.id} table={table} />)}
                </section>
              ))}
            </div>

            <aside className="st-side">
              <nav className="st-index" aria-labelledby="st-index-title">
                <p className="bp-eyebrow" id="st-index-title">On this page</p>
                {groups.map((group) => (
                  <div className="st-index-group" key={group.period}>
                    <a className="st-index-period" href={`#${group.anchor}`}>{group.period}</a>
                    <ul>
                      {group.tables.map((table) => <li key={table.id}><a href={`#${table.id}`}>{table.title}</a></li>)}
                    </ul>
                  </div>
                ))}
              </nav>
            </aside>
          </div>
        ) : (
          <div className="bp-body">
            <div className="bp-empty">
              <span className="bp-empty-scope" aria-hidden="true"><i /></span>
              <h2>No figures published yet.</h2>
              <p>Tables from the commission appear here as soon as they’re published: voters, turnout, candidates and results.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
