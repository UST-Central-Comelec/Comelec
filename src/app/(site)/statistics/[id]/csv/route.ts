import { getStatisticForSite } from "@/lib/statistics/queries";
import { toCsv } from "@/lib/statistics/table";

/** One of the Statistics page's tables as a CSV file, for its Download button. */
export async function GET(_request: Request, { params }: RouteContext<"/statistics/[id]/csv">) {
  const { id } = await params;
  const table = /^[a-z0-9][a-z0-9-]{0,79}$/.test(id) ? await getStatisticForSite(id) : null;
  if (!table) return new Response("That table isn’t on the Statistics page.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  return new Response(toCsv(table), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${table.id}.csv"`,
      // Always the figures as they stand: a table can be corrected in the portal at any time.
      "Cache-Control": "no-store",
    },
  });
}
