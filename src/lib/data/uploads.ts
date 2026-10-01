import "server-only";

import { randomUUID } from "node:crypto";
import { UPLOADS_BUCKET } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";

// Member photo uploads, stored in the public Supabase Storage bucket `uploads`. Records keep the
// file's public URL. (Official documents go to Google Drive instead: src/lib/data/drive-upload.ts.)
// The portal compresses photos in the browser before sending (src/components/portal/photo-input.tsx).

export const MAX_UPLOAD_BYTES = 1024 * 1024;

export const uploadRules = {
  photo: { folder: "members", types: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }, maxBytes: MAX_UPLOAD_BYTES, label: "a JPG, PNG or WebP up to 1 MB" },
} as const;

export type UploadKind = keyof typeof uploadRules;

export function hasFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

// The browser-reported type comes from the file extension, so also check the file's first bytes.
const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/png": (b) => b[0] === 0x89 && ascii(b, 1, 3) === "PNG",
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP",
};

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Returns an error message, or null when the file is acceptable. */
export async function checkUpload(file: File, kind: UploadKind) {
  const rule = uploadRules[kind];
  if (!(file.type in rule.types) || file.size > rule.maxBytes) return `Upload ${rule.label}.`;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!signatures[file.type]?.(head)) return `That file’s contents don’t match its type. Upload ${rule.label}.`;
  return null;
}

export async function saveUpload(file: File, kind: UploadKind) {
  const rule = uploadRules[kind];
  const extension = rule.types[file.type as keyof typeof rule.types];
  const objectPath = `${rule.folder}/${randomUUID()}${extension}`;
  const storage = createAdminClient().storage.from(UPLOADS_BUCKET);

  const { error } = await storage.upload(objectPath, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Couldn’t upload the file: ${error.message}`);
  return { url: storage.getPublicUrl(objectPath).data.publicUrl, name: file.name };
}

/** Removes a previously uploaded file. Ignores URLs that aren't in the uploads bucket. */
export async function deleteUpload(url: string | null) {
  const marker = `/storage/v1/object/public/${UPLOADS_BUCKET}/`;
  const index = url?.indexOf(marker) ?? -1;
  if (!url || index === -1) return;
  await createAdminClient().storage.from(UPLOADS_BUCKET).remove([decodeURIComponent(url.slice(index + marker.length))]);
}
