"use server";

import { headers } from "next/headers";
import { requireEditor } from "@/lib/auth/session";
import { isDriveUploadConfigured, MAX_DOCUMENT_BYTES, publishDriveUpload, startDriveUpload } from "@/lib/data/drive-upload";

const failed = { error: "Couldn’t reach Google Drive. Try again, or paste a Drive link instead." };

/** Step 1: the browser asks where to send the PDF. */
export async function startDocumentUpload(fileName: string, size: number): Promise<{ session: string } | { error: string }> {
  await requireEditor("documents");
  if (!isDriveUploadConfigured()) return { error: "Uploading isn’t set up yet. Paste a Drive link instead." };
  const name = typeof fileName === "string" ? fileName.trim().slice(0, 200) : "";
  if (!/\.pdf$/i.test(name) || !Number.isInteger(size) || size <= 0 || size > MAX_DOCUMENT_BYTES) return { error: `Upload a PDF up to ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.` };

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return failed;
  try {
    return { session: await startDriveUpload(name, size, origin) };
  } catch (error) {
    console.error(error);
    return failed;
  }
}

/** Step 2: once the file is in Drive, share it and hand back its link for the form. */
export async function finishDocumentUpload(fileId: string): Promise<{ link: string } | { error: string }> {
  await requireEditor("documents");
  if (!isDriveUploadConfigured() || typeof fileId !== "string" || !/^[\w-]{10,}$/.test(fileId)) return failed;
  try {
    const link = await publishDriveUpload(fileId);
    return link ? { link } : { error: "That upload wasn’t a PDF. Try again." };
  } catch (error) {
    console.error(error);
    return { error: "The file uploaded, but Google Drive wouldn’t make it public. Check the account’s sharing settings." };
  }
}
