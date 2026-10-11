import { getPartyRegistration } from "@/lib/polpar/store";
import { createAdminClient } from "@/lib/supabase/server";
import { POLPAR_BUCKET } from "@/lib/polpar/content";
import { signedDownloadUrl } from "@/lib/storage/r2";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const record = await getPartyRegistration(id);
  if (!/^\d+$/.test(index)) return new Response("Not found", { status: 404 });
  const document = record.documents[Number(index)];
  if (!document) return new Response("Not found", { status: 404 });
  let location: string;
  if (document.store === "r2") {
    try { location = await signedDownloadUrl(document.path, 60, document.name); }
    catch { return new Response("Document unavailable. Please try again.", { status: 503 }); }
  } else {
    // Filed before the move to R2.
    const { data, error } = await createAdminClient().storage.from(POLPAR_BUCKET).createSignedUrl(document.path, 60, { download: document.name });
    if (error) return new Response("Document unavailable. Please try again.", { status: 503 });
    location = data.signedUrl;
  }
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
