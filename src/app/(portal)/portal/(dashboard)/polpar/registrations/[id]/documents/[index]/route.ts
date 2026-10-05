import { getPartyRegistration } from "@/lib/polpar/store";
import { createAdminClient } from "@/lib/supabase/server";
import { POLPAR_BUCKET } from "@/lib/polpar/content";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await params;
  const record = await getPartyRegistration(id);
  if (!/^\d+$/.test(index)) return new Response("Not found", { status: 404 });
  const document = record.documents[Number(index)];
  if (!document) return new Response("Not found", { status: 404 });
  const { data, error } = await createAdminClient().storage.from(POLPAR_BUCKET).createSignedUrl(document.path, 60, { download: document.name });
  if (error) return new Response("Document unavailable. Please try again.", { status: 503 });
  return new Response(null, { status: 303, headers: { Location: data.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
