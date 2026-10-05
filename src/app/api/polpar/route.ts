import { randomUUID } from "node:crypto";
import { isAccepting } from "@/lib/applications/period";
import { getUnitPeriod } from "@/lib/periods/store";
import { unitFromKey } from "@/lib/periods/kinds";
import { clientIp, limits, rateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { MAX_FILE_BYTES, MAX_REQUEST_BYTES, MAX_TOTAL_BYTES, POLPAR_BUCKET, requirements, uploadTypes } from "@/lib/polpar/content";
import { fieldErrors, partyRegistrationSchema, type PartyDocument, type PartyResponse } from "@/lib/polpar/schema";

export const runtime = "nodejs";
const reply = (body: PartyResponse, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Bound the actual stream, including chunked requests without Content-Length. */
async function readForm(request: Request) {
  if (!request.body) throw new Error("empty_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new Error("too_large"); }
    chunks.push(new Uint8Array(value));
  }
  return new Response(new Blob(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
}

function matchesType(bytes: Buffer, type: string) {
  if (type === "application/pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return reply({ error: "Please submit through the registration page." }, 403);
  if (!isSupabaseConfigured()) return reply({ error: "Online registration is unavailable. Please contact comelec@ust.edu.ph." }, 503);
  const limited = rateLimit(`polpar:${clientIp(request.headers)}`, limits.apply.limit, limits.apply.windowMs);
  if (!limited.ok) return reply({ error: "Too many submission attempts. Please try again later." }, 429);
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return reply({ error: "Keep the combined uploads below 30 MB." }, 413);

  const client = createAdminClient();
  const uploaded: string[] = [];
  let committed = false;
  try {
    const form = await readForm(request);
    const raw = form.get("payload");
    if (typeof raw !== "string" || raw.length > 1024 * 1024) return reply({ error: "The form data is missing or too large." }, 400);
    const parsed = partyRegistrationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return reply({ error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) }, 400);
    const data = parsed.data;
    const submissionId = form.get("submissionId");
    if (typeof submissionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) return reply({ error: "Reload the registration page and try again." }, 400);

    // A retry after a lost response returns the same receipt instead of filing twice.
    const previous = await client.from("party_registrations").select("reference, party_name, created_at").eq("id", submissionId).maybeSingle();
    if (previous.error) throw new Error(previous.error.message);
    if (previous.data) return reply({ receipt: { reference: previous.data.reference, partyName: previous.data.party_name, submittedAt: previous.data.created_at } });

    const unit = unitFromKey(data.unit === "central" ? "" : data.unit);
    if (!isAccepting(await getUnitPeriod("party-registration", unit))) return reply({ error: "This unit’s registration period has closed. Your registration was not submitted." }, 409);

    const files: { file: File; requirement: string; bytes: Buffer }[] = [];
    let total = 0;
    const errors: Record<string, string> = {};
    for (const requirement of requirements) {
      const entries = form.getAll(requirement.id).filter((entry): entry is File => entry instanceof File && entry.size > 0);
      if (!entries.length && !(requirement.id === "alumniIds" && data.alumni.length === 0)) errors[requirement.id] = "Attach this requirement.";
      for (const file of entries) {
        total += file.size;
        if (file.size > MAX_FILE_BYTES || !Object.hasOwn(uploadTypes, file.type)) { errors[requirement.id] = "Use PDF, JPG, or PNG files up to 10 MB each."; continue; }
        const bytes = Buffer.from(await file.arrayBuffer());
        if (!matchesType(bytes, file.type)) { errors[requirement.id] = "The file contents don’t match its format. Export a PDF, JPG, or PNG and try again."; continue; }
        files.push({ file, requirement: requirement.id, bytes });
      }
    }
    if (total > MAX_TOTAL_BYTES) return reply({ error: "Keep the combined uploads below 30 MB." }, 413);
    if (Object.keys(errors).length) return reply({ error: "Check the document uploads.", fieldErrors: errors }, 400);

    const documents: PartyDocument[] = [];
    const batch = randomUUID();
    for (const { file, requirement, bytes } of files) {
      const extension = uploadTypes[file.type as keyof typeof uploadTypes];
      const path = `${submissionId}/${batch}/${requirement}-${randomUUID()}.${extension}`;
      const { error } = await client.storage.from(POLPAR_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      uploaded.push(path);
      documents.push({ requirement, name: file.name.slice(0, 250), path, size: file.size, type: file.type });
    }
    const reference = `PP-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const { data: saved, error } = await client.from("party_registrations").insert({ id: submissionId, reference, party_name: data.partyName, college: unit.college ?? "", email: data.email, payload: data, documents }).select("reference, party_name, created_at").single();
    if (error) {
      if (error.message.includes("party_registration_closed")) return reply({ error: "This unit’s registration period closed before your application could be saved." }, 409);
      if (error.code === "23505") {
        const retry = await client.from("party_registrations").select("reference, party_name, created_at").eq("id", submissionId).maybeSingle();
        if (retry.data) return reply({ receipt: { reference: retry.data.reference, partyName: retry.data.party_name, submittedAt: retry.data.created_at } });
      }
      throw new Error(error.message);
    }
    committed = true;
    return reply({ receipt: { reference: saved.reference, partyName: saved.party_name, submittedAt: saved.created_at } });
  } catch (error) {
    if (error instanceof Error && error.message === "too_large") return reply({ error: "Keep the combined uploads below 30 MB." }, 413);
    if (error instanceof SyntaxError || error instanceof TypeError) return reply({ error: "The form could not be read. Please check your files and try again." }, 400);
    console.error("Couldn’t save party registration:", error instanceof Error ? error.message : "Unknown error");
    return reply({ error: "Your registration could not be saved. Please retry or contact comelec@ust.edu.ph. Your entries are still on this page." }, 503);
  } finally {
    if (!committed && uploaded.length) {
      try {
        const { error } = await client.storage.from(POLPAR_BUCKET).remove(uploaded);
        if (error) console.error("Couldn’t remove incomplete party uploads:", error.message);
      } catch { console.error("Couldn’t remove incomplete party uploads."); }
    }
  }
}
