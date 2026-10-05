import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/data/types";
import { settle } from "@/lib/portal/settle";
import { getStatistics } from "@/lib/statistics/queries";
import { byPeriod, sizeLabel } from "@/lib/statistics/table";

export const metadata: Metadata = { title: "Statistics" };

export default async function PortalStatisticsPage({ searchParams }: PageProps<"/portal/statistics">) {
  const [{ readOnly }, [{ value, error: loadError }, { notice }]] = await withPortalUser(Promise.all([settle(getStatistics()), searchParams]), allowed("statistics"));
  // In the order of the website's page: by election or period, the most recent figures first.
  const tables = byPeriod(value ?? []).flatMap((group) => group.tables);

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Website content</p>
          <TitleWithInfo info="Tables of figures shown on the website’s Statistics page: voters, turnout, candidates, results. Each is pasted from a spreadsheet, and the page groups them by the election or period they belong to.">Statistics</TitleWithInfo>
        </div>
        {readOnly ? <ViewOnlyTag /> : <Link className="portal-button" href="/portal/statistics/new"><Plus size={16} /> Add table</Link>}
      </header>
      <Notice notice={notice} />

      {loadError ? (
        <p className="portal-form-error" role="alert">
          Couldn’t load statistics. Run <code>supabase/migrations/0020_news_categories_and_statistics.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      ) : (
        <section className="portal-card is-flush">
          {tables.length === 0 ? (
            <p className="portal-empty">No tables yet.{!readOnly && <> <Link href="/portal/statistics/new">Add the first one.</Link></>}</p>
          ) : (
            <div className="portal-table-wrap">
              <table className="portal-table portal-stat-list">
                <thead><tr><th>Table</th><th>Election or period</th><th>As of</th><th>Size</th><th /></tr></thead>
                <tbody>
                  {tables.map((table) => (
                    <tr key={table.id}>
                      <td><Link className="portal-row-title" href={`/portal/statistics/${table.id}`}>{table.title}</Link></td>
                      <td><span className="portal-tag">{table.period}</span></td>
                      <td className="portal-muted">{formatDate(table.asOf)}</td>
                      <td className="portal-muted">{sizeLabel(table)}</td>
                      <td className="portal-row-actions"><Link href={`/portal/statistics/${table.id}`}>{readOnly ? "View" : "Edit"}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
