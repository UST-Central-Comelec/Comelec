import { getPortalUser, canOpen } from "@/lib/auth/session";
import { getAccounts, getDirectory } from "@/lib/data/queries";
import { directoryDatabaseRows, filterDirectoryDatabase } from "@/lib/portal/directory-database";
import { createDirectoryExport, directoryExportFormats, type DirectoryExportFormat } from "@/lib/portal/directory-export";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const user = await getPortalUser();
  if (!user) return Response.json({ error: "Sign in to download the directory." }, { status: 401, headers });
  if (!canOpen(user, "members")) return Response.json({ error: "You don’t have access to the directory." }, { status: 403, headers });
  const params = new URL(request.url).searchParams;
  const format = params.get("format") ?? "";
  if (!directoryExportFormats.includes(format as DirectoryExportFormat)) return Response.json({ error: "Choose an export format." }, { status: 400, headers });
  try {
    const [directory, accounts] = await Promise.all([getDirectory(), getAccounts()]);
    const rows = directoryDatabaseRows([...directory.central, ...directory.local], accounts, user, canOpen(user, "accounts") && !user.readOnly);
    const shown = filterDirectoryDatabase(rows, params.get("unit") ?? "", params.get("q") ?? "");
    const result = await createDirectoryExport(shown, format as DirectoryExportFormat);
    return new Response(typeof result.body === "string" ? result.body : Buffer.from(result.body), { headers: { ...headers, "Content-Type": result.type, "Content-Disposition": `attachment; filename="ust-comelec-directory.${format}"` } });
  } catch {
    return Response.json({ error: "Couldn’t export the directory. Try again." }, { status: 500, headers });
  }
}
