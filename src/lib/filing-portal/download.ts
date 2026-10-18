import "server-only";

import { signedDownloadUrl } from "@/lib/storage/r2";
import type { FilingFile } from "./types";

/**
 * Sends the browser to a short-lived link for one of a record's files: a document's, a campaign
 * material's or a petition's. Whoever's asking has been checked already: the party's member, the
 * candidate or the filer, or a reviewer who may see the unit.
 */
export async function fileResponse(document: { files: FilingFile[] } | null, index: string) {
  if (!document || !/^\d+$/.test(index)) return new Response("Not found", { status: 404 });
  const file = document.files[Number(index)];
  if (!file) return new Response("Not found", { status: 404 });
  let location: string;
  try { location = await signedDownloadUrl(file.path, 60, file.name); }
  catch { return new Response("File unavailable. Please try again.", { status: 503 }); }
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
