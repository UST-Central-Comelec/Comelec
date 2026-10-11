"use server";

import { requireEditor } from "@/lib/auth/session";
import { checkUpload, hasFile, saveUpload } from "@/lib/data/uploads";

export type FormImageResult = { url?: string; error?: string };

/**
 * An image for an RSVP or Evaluation form (Add Image). It's stored at once, so the editor can show
 * it; the form records its address when it's saved. The browser has already shrunk it to 1 MB.
 */
export async function uploadFormImage(form: FormData): Promise<FormImageResult> {
  await requireEditor("events");
  const file = form.get("image");
  if (!hasFile(file)) return { error: "Choose an image to upload." };
  const problem = await checkUpload(file, "formImage");
  if (problem) return { error: problem };
  try {
    return { url: (await saveUpload(file, "formImage")).url };
  } catch {
    return { error: "Couldn’t upload the image. Please try again." };
  }
}
