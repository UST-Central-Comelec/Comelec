import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/portal/delete-button";
import { StatisticForm } from "@/components/portal/statistic-form";
import { ViewOnly } from "@/components/portal/view-only";
import { allowed, withPortalUser } from "@/lib/auth/session";
import { deleteStatistic, updateStatistic } from "@/lib/portal/statistic-actions";
import { getStatistics } from "@/lib/statistics/queries";
import { byPeriod } from "@/lib/statistics/table";

export const metadata: Metadata = { title: "Edit table" };

export default async function EditStatisticPage({ params }: PageProps<"/portal/statistics/[id]">) {
  const [{ readOnly }, [{ id }, tables]] = await withPortalUser(Promise.all([params, getStatistics()]), allowed("statistics"));
  const table = tables.find((item) => item.id === id);
  if (!table) notFound();

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/statistics">← Statistics</Link>
          <h1>{readOnly ? "Table" : "Edit table"}</h1>
          <p className="portal-muted">Last updated {new Date(table.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by {table.updatedBy}. <a href={`/statistics#${table.id}`} target="_blank" rel="noreferrer">View on website ↗</a></p>
        </div>
      </header>
      <section className="portal-card">
        <ViewOnly when={readOnly}>
          <StatisticForm
            action={updateStatistic.bind(null, table.id)}
            submitLabel="Save changes"
            periods={byPeriod(tables).map((group) => group.period)}
            initial={table}
            danger={<DeleteButton action={deleteStatistic.bind(null, table.id)} label="Delete table" />}
          />
        </ViewOnly>
      </section>
    </main>
  );
}
