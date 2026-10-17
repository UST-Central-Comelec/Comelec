import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isCandidacyRequirement } from "@/lib/candidacy/content";
import { addCandidacyFiles, candidacyBytes, getCandidacyDocument } from "@/lib/candidacy/store";
import { reachesUnit } from "@/lib/candidacy/types";
import { getFilingAccount } from "@/lib/filing-portal/session";
import { fullName, isEditable, MAX_APPLICATION_BYTES, MAX_FILE_BYTES, MAX_FILES_PER_REQUIREMENT, type FilingDocument, type FilingFile } from "@/lib/filing-portal/types";
import { addFiles, getSubmission, partyBytes } from "@/lib/party-portal/store";
import { requirements, uploadTypes } from "@/lib/polpar/content";
import { deleteObjects, isR2Configured, putObject } from "@/lib/storage/r2";

// Uploads a requirement's files from the filing portal: a party's (`area=party`) or the candidate's
// own (`area=candidacy`), one requirement at a time, PDF, JPG or PNG, 10 MB each. The files go to
// R2's private bucket, then onto the requirement in one statement, so two members uploading at once
// keep both. A route rather than a Server Action, whose request size is kept small (next.config.ts).

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = MAX_FILES_PER_REQUIREMENT * MAX_FILE_BYTES + 1024 * 1024;
const reply = (body: { error?: string; ok?: string }, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

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

/** The file is what its type says it is: a PDF, PNG or JPEG by its first bytes. */
function matchesType(bytes: Buffer, type: string) {
  if (type === "application/pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

type Destination = {
  folder: string;
  current: () => Promise<FilingDocument | null>;
  bytes: () => Promise<number>;
  add: (files: FilingFile[]) => Promise<unknown>;
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return reply({ error: "Upload from the filing portal." }, 403);
  const account = await getFilingAccount();
  if (!account) return reply({ error: "Your session ended. Sign in again to upload." }, 401);
  if (!isR2Configured()) return reply({ error: "Uploads aren’t available right now. Try again later." }, 503);
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return reply({ error: "Upload up to 10 files of 10 MB each at a time." }, 413);

  const uploaded: string[] = [];
  let committed = false;
  try {
    const form = await readForm(request);
    const area = form.get("area");
    const requirement = form.get("requirement");
    if (typeof requirement !== "string") return reply({ error: "That isn’t one of the requirements." }, 400);

    let destination: Destination;
    if (area === "party") {
      const { membership } = account;
      if (!membership || membership.member.status !== "active") return reply({ error: "You can upload once the party’s contact person approves you." }, 403);
      if (membership.party.status !== "pending") return reply({ error: "The party’s registration has been decided, so its documents can’t change now." }, 409);
      if (!requirements.some((item) => item.id === requirement)) return reply({ error: "That isn’t one of the requirements." }, 400);
      const id = membership.party.id;
      destination = { folder: `party-portal/${id}/${requirement}`, current: () => getSubmission(id, requirement), bytes: () => partyBytes(id), add: (files) => addFiles(id, requirement, files) };
    } else if (area === "candidacy") {
      const { candidacy } = account;
      if (!candidacy) return reply({ error: "File your candidacy first." }, 403);
      if (candidacy.status !== "pending") return reply({ error: "Your candidacy has been decided, so its documents can’t change now." }, 409);
      if (!reachesUnit(candidacy)) return reply({ error: "You can upload once your party endorses your candidacy." }, 409);
      if (!isCandidacyRequirement(requirement)) return reply({ error: "That isn’t one of the requirements." }, 400);
      const id = candidacy.id;
      destination = { folder: `candidacy/${id}/${requirement}`, current: () => getCandidacyDocument(id, requirement), bytes: () => candidacyBytes(id), add: (files) => addCandidacyFiles(id, requirement, files) };
    } else return reply({ error: "Upload from the filing portal." }, 400);

    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (!files.length) return reply({ error: "Choose at least one file." }, 400);
    const current = await destination.current();
    if (current && !isEditable(current.status)) return reply({ error: "This document was sent for review, so its files can’t change. Take it back first." }, 409);
    if ((current?.files.length ?? 0) + files.length > MAX_FILES_PER_REQUIREMENT) return reply({ error: `Each requirement takes up to ${MAX_FILES_PER_REQUIREMENT} files. Remove some first.` }, 400);
    if ((await destination.bytes()) + files.reduce((sum, file) => sum + file.size, 0) > MAX_APPLICATION_BYTES) return reply({ error: "The files would go over 200 MB in all. Remove some, or make them smaller." }, 413);

    const saved: FilingFile[] = [];
    const now = new Date().toISOString();
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES || !Object.hasOwn(uploadTypes, file.type)) return reply({ error: `${file.name}: use PDF, JPG or PNG files of up to 10 MB each.` }, 400);
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!matchesType(bytes, file.type)) return reply({ error: `${file.name}: the file’s contents don’t match its type. Export it as a PDF, JPG or PNG and try again.` }, 400);
      const path = `${destination.folder}/${randomUUID()}.${uploadTypes[file.type as keyof typeof uploadTypes]}`;
      await putObject("private", path, bytes, { contentType: file.type });
      uploaded.push(path);
      saved.push({ name: file.name.slice(0, 200), path, size: file.size, type: file.type, uploadedBy: fullName(account.account), uploadedAt: now });
    }
    if ((await destination.add(saved)) === "locked") return reply({ error: "This document was sent for review while you were uploading, so its files can’t change. Take it back first." }, 409);
    committed = true;
    revalidatePath("/filing", "layout");
    return reply({ ok: files.length === 1 ? `Uploaded ${files[0].name}.` : `Uploaded ${files.length} files.` });
  } catch (error) {
    if (error instanceof Error && error.message === "too_large") return reply({ error: "Upload up to 10 files of 10 MB each at a time." }, 413);
    console.error("Couldn’t upload a filing document:", error instanceof Error ? error.message : error);
    return reply({ error: "The files couldn’t be uploaded. Try again." }, 503);
  } finally {
    if (!committed && uploaded.length) {
      try { await deleteObjects("private", uploaded); } catch { console.error("Couldn’t remove incomplete uploads."); }
    }
  }
}
