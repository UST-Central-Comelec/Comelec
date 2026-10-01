import "server-only";

import { store } from "@/lib/data/store";
import type { StatisticTable } from "./table";

// The Statistics page's tables as the website and the portal read them, from public.statistics
// (supabase/migrations/0020_news_categories_and_statistics.sql) through the content store.

const strings = (value: unknown) => (Array.isArray(value) ? value.map((item) => (typeof item === "string" ? item : String(item ?? ""))) : []);

/** A stored row as a table whose every row is as wide as its headings, whatever was saved. */
function normalize(table: StatisticTable): StatisticTable {
  const columns = strings(table.columns);
  const rows = (Array.isArray(table.rows) ? table.rows : []).map((row) => {
    const cells = strings(row);
    return columns.map((_, index) => cells[index] ?? "");
  });
  const barColumn = typeof table.barColumn === "number" && table.barColumn > 0 && table.barColumn < columns.length ? table.barColumn : null;
  return { ...table, columns, rows, barColumn, summary: table.summary ?? "", note: table.note ?? "", showTotal: Boolean(table.showTotal) };
}

/** Every table, the most recent figures first. */
export async function getStatistics() {
  return (await store.list("statistics")).map(normalize).sort((a, b) => b.asOf.localeCompare(a.asOf) || a.title.localeCompare(b.title));
}

export async function getStatistic(id: string) {
  const table = await store.get("statistics", id);
  return table ? normalize(table) : null;
}

/**
 * For the website: a statistics hiccup (or a database that hasn't had 0020 run yet) shows no tables
 * rather than taking the page down.
 */
export async function getStatisticsForSite() {
  try {
    return await getStatistics();
  } catch (error) {
    console.error(error);
    return [];
  }
}

/** For a table's download on the website: one that can't be loaded reads as not found. */
export async function getStatisticForSite(id: string) {
  try {
    return await getStatistic(id);
  } catch (error) {
    console.error(error);
    return null;
  }
}
