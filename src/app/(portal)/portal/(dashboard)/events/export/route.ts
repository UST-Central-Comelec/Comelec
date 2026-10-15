import { z } from "zod";
import { getPortalUser, canOpen } from "@/lib/auth/session";
import { createTableExport } from "@/lib/portal/table-export";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const MAX_BYTES = 2 * 1024 * 1024;
const tooLarge = () => new Error("export_too_large");

/** Count actual bytes, including chunked bodies and misleading Content-Length headers. */
async function readPayload(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) throw tooLarge();
  if (!request.body) throw new SyntaxError("Empty export");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw tooLarge(); }
      chunks.push(new Uint8Array(value));
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(await new Blob(chunks).text());
}
const payload = z.object({
  format: z.enum(["xlsx", "pdf", "csv", "json"]),
  columns: z.array(z.string().min(1).max(100)).min(1).max(30),
  rows: z.array(z.array(z.string().max(10000)).max(30)).max(10000),
}).refine(data => data.rows.every(row => row.length === data.columns.length));

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const user = await getPortalUser();
  if (!user) return Response.json({ error: "Sign in to export registrants." }, { status: 401, headers });
  if (!canOpen(user, "events")) return Response.json({ error: "You don’t have access to events." }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Export from the event’s responses page." }, { status: 403, headers });
  const limited = rateLimit(`event-export:${user.email}`, 10, 60_000);
  if (!limited.ok) return Response.json({ error: "Please wait a minute before exporting again." }, { status: 429, headers: { ...headers, "Retry-After": String(limited.retryAfter) } });
  try {
    // Serialize only the filtered table already available to the signed-in browser.
    const parsed = payload.safeParse(await readPayload(request));
    if (!parsed.success) return Response.json({ error: "Couldn’t read the table. Reload and try again." }, { status: 400, headers });
    const { columns, rows, format } = parsed.data;
    // PDF wrapping and font layout are much more expensive than text serialization.
    if (format === "pdf" && [...columns, ...rows.flat()].reduce((size, cell) => size + cell.length, 0) > 200_000) return Response.json({ error: "Filter the table to fewer responses for PDF, or choose CSV or Excel." }, { status: 413, headers });
    const result = await createTableExport(columns, rows, format);
    return new Response(typeof result.body === "string" ? result.body : Buffer.from(result.body), { headers: { ...headers, "Content-Type": result.type, "Content-Disposition": `attachment; filename="event-registrants.${format}"` } });
  } catch (error) {
    if (error instanceof Error && error.message === "export_too_large") return Response.json({ error: "Filter the table to fewer responses, then export again." }, { status: 413, headers });
    if (error instanceof SyntaxError) return Response.json({ error: "Couldn’t read the table. Reload and try again." }, { status: 400, headers });
    return Response.json({ error: "Couldn’t export the data. Try again." }, { status: 500, headers });
  }
}
