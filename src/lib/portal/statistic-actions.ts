"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireEditor } from "@/lib/auth/session";
import { conflictState, readGuard, saveGuarded } from "@/lib/data/edit-guard";
import { store } from "@/lib/data/store";
import { getStatistic } from "@/lib/statistics/queries";
import { barColumns, columnKinds, parseTable } from "@/lib/statistics/table";
import { text, toFormState, type FormState } from "./form";

// The Statistics page's tables, as the portal's Statistics tab manages them. Central accounts only,
// like News. A table arrives as pasted text and is saved as headings and rows
// (src/lib/statistics/table.ts reads it, the same way the form's preview does).

const statisticSchema = z.object({
  title: z.string().trim().min(3, "Add a title.").max(140, "Keep the title under 140 characters."),
  period: z.string().trim().min(2, "Say which election or period these figures belong to.").max(100, "Keep this under 100 characters."),
  asOf: z.iso.date("Pick the date the figures are as of."),
  summary: z.string().trim().max(300, "Keep the description under 300 characters."),
  data: z.string().max(60000, "That’s too much text for one table."),
  barColumn: z.string(),
  showTotal: z.boolean(),
  note: z.string().trim().max(400, "Keep the note under 400 characters."),
});

/** The form as a table ready to save, or what to tell the commissioner. */
function read(formData: FormData) {
  const parsed = statisticSchema.safeParse({
    title: text(formData, "title"),
    period: text(formData, "period"),
    asOf: text(formData, "asOf"),
    summary: text(formData, "summary"),
    data: text(formData, "data"),
    barColumn: text(formData, "barColumn"),
    showTotal: formData.get("showTotal") === "on",
    note: text(formData, "note"),
  });
  // The pasted table is read whatever else is wrong, so every field that needs fixing is marked at once.
  const grid = parseTable(text(formData, "data").slice(0, 60000));
  if (!parsed.success || "error" in grid) {
    const fieldErrors = { ...("error" in grid && { data: grid.error }), ...(parsed.success ? {} : toFormState(parsed.error)?.fieldErrors) };
    return { state: { error: "Check the highlighted fields.", fieldErrors } satisfies FormState };
  }

  const { title, period, asOf, summary, barColumn, showTotal, note } = parsed.data;

  // Bars only for a column of figures; anything else (the table changed under the choice) means none.
  const chosen = barColumn === "" ? null : Number(barColumn);
  const bars = chosen !== null && barColumns(columnKinds(grid)).includes(chosen) ? chosen : null;
  // Tables are grouped by this wording, so stray spaces don't split a group in two.
  return { fields: { title, period: period.replace(/\s+/g, " "), asOf, summary, columns: grid.columns, rows: grid.rows, barColumn: bars, showTotal, note } };
}

/** Why saving failed, in words a commissioner can act on. */
function saveError(error: unknown): FormState {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Couldn’t save the statistics table:", message);
  if (message.includes("'public.statistics'") || message.includes("schema cache")) return { error: "Statistics aren’t set up in the database yet. Run supabase/migrations/0020_news_categories_and_statistics.sql in the Supabase SQL Editor, then save again." };
  return { error: "Something went wrong saving the table. Please try again." };
}

/** The form's fields, as a conflict names them. The figures are one field: columns and rows only make sense together. */
const labels: Record<string, string> = { title: "Title", period: "Election or period", asOf: "Figures as of", summary: "Short description", columns: "Figures", rows: "Figures", barColumn: "Draw bars for", showTotal: "Add a row of totals", note: "Note or source" };
const figures = [["columns", "rows", "barColumn", "showTotal"]] as const;

function refresh() {
  revalidatePath("/statistics");
  revalidatePath("/portal/statistics");
}

export async function createStatistic(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requireEditor("statistics");
  const { fields, state } = read(formData);
  if (!fields) return state;

  try {
    // "New" would take the address of the page that adds a table.
    await store.create("statistics", fields, email, fields.title.trim().toLowerCase() === "new" ? "new-table" : fields.title);
  } catch (error) {
    return saveError(error);
  }
  refresh();
  redirect("/portal/statistics?notice=statistic-created");
}

export async function updateStatistic(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requireEditor("statistics");
  const { fields, state } = read(formData);
  if (!fields) return state;

  let result;
  try {
    result = await saveGuarded("statistics", id, fields, email, readGuard(formData), { load: () => getStatistic(id), groups: figures });
  } catch (error) {
    return saveError(error);
  }
  if ("missing" in result) return { error: "This table no longer exists." };
  if ("conflict" in result) return conflictState(result.conflict, labels, "table", email);
  refresh();
  redirect(`/portal/statistics?notice=${result.merged ? "statistic-updated-merged" : "statistic-updated"}`);
}

export async function deleteStatistic(id: string) {
  await requireEditor("statistics");
  await store.remove("statistics", id);
  refresh();
  redirect("/portal/statistics?notice=statistic-deleted");
}
