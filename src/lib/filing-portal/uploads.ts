import "server-only";

import { randomUUID } from "node:crypto";
import { uploadTypes } from "@/lib/polpar/content";
import { deleteObjects, putObject } from "@/lib/storage/r2";
import { MAX_FILE_BYTES, type FilingFile } from "./types";

// What the filing portal's upload routes share: reading a bounded multipart body, checking that a
// file is the PDF, JPG or PNG it says it is, and putting files in R2's private bucket. A route
// rather than a Server Action, whose request size is kept small (next.config.ts).

export const reply = (body: { error?: string; ok?: string; id?: string }, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Bound the actual stream, including chunked requests without Content-Length. Throws "too_large" past `limit` bytes. */
export async function readForm(request: Request, limit: number) {
  if (!request.body) throw new Error("empty_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("too_large"); }
    chunks.push(new Uint8Array(value));
  }
  return new Response(new Blob(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
}

/** The file is what its type says it is: a PDF, PNG or JPEG by its first bytes. */
export function matchesType(bytes: Buffer, type: string) {
  if (type === "application/pdf") return bytes.subarray(0, 5).toString() === "%PDF-";
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

/** The request comes from this site's own pages. */
export const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
};

/** The non-empty files sent under `name`. */
export const filesOf = (form: FormData, name = "files") => form.getAll(name).filter((entry): entry is File => entry instanceof File && entry.size > 0);

/**
 * Checks and stores files under `folder`, adding each one's key to `uploaded` as it goes (so the
 * caller can remove them if what they belong to isn't saved). Returns the files, or what's wrong.
 */
export async function storeFiles(files: File[], folder: string, uploadedBy: string, uploaded: string[]): Promise<FilingFile[] | { error: string }> {
  const saved: FilingFile[] = [];
  const now = new Date().toISOString();
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES || !Object.hasOwn(uploadTypes, file.type)) return { error: `${file.name}: use PDF, JPG or PNG files of up to 10 MB each.` };
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!matchesType(bytes, file.type)) return { error: `${file.name}: the file’s contents don’t match its type. Export it as a PDF, JPG or PNG and try again.` };
    const path = `${folder}/${randomUUID()}.${uploadTypes[file.type as keyof typeof uploadTypes]}`;
    await putObject("private", path, bytes, { contentType: file.type });
    uploaded.push(path);
    saved.push({ name: file.name.slice(0, 200), path, size: file.size, type: file.type, uploadedBy, uploadedAt: now });
  }
  return saved;
}

/** Removes files that were put in R2 for something that wasn't saved. Never throws. */
export async function discardFiles(paths: string[]) {
  if (!paths.length) return;
  try { await deleteObjects("private", paths); } catch { console.error("Couldn’t remove incomplete uploads."); }
}
