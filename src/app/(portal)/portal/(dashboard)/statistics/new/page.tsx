import type { Metadata } from "next";
import Link from "next/link";
import { StatisticForm } from "@/components/portal/statistic-form";
import { requireCentral } from "@/lib/auth/session";
import { settle } from "@/lib/portal/settle";
import { createStatistic } from "@/lib/portal/statistic-actions";
import { getStatistics } from "@/lib/statistics/queries";
import { byPeriod } from "@/lib/statistics/table";

export const metadata: Metadata = { title: "Add table" };

export default async function NewStatisticPage() {
  await requireCentral();
  // The groups already in use, to suggest. If they can't be loaded, the form still works without them.
  const periods = byPeriod((await settle(getStatistics())).value ?? []).map((group) => group.period);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/statistics">← Statistics</Link>
          <h1>Add table</h1>
        </div>
      </header>
      <section className="portal-card">
        <StatisticForm action={createStatistic} submitLabel="Publish table" periods={periods} initial={{ title: "", period: periods[0] ?? "", asOf: today, summary: "", columns: [], rows: [], barColumn: null, showTotal: false, note: "" }} />
      </section>
    </main>
  );
}
