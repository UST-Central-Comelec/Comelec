"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePortalUser } from "@/lib/auth/session";
import { store } from "@/lib/data/store";
import { documentKinds, type DocumentKind } from "@/lib/data/types";
import { checkDriveSharing, normalizeDriveLink } from "@/lib/data/drive";
import { deleteUpload } from "@/lib/data/uploads";
import { text, toFormState, type FormState } from "./form";

const documentSchema = z.object({
  kind: z.enum(Object.keys(documentKinds) as [DocumentKind, ...DocumentKind[]], "Pick a document type."),
  title: z.string().trim().min(3, "Add a title.").max(200, "Keep the title under 200 characters."),
  reference: z.string().trim().max(80, "Keep the reference number under 80 characters."),
  date: z.iso.date("Pick the date it was issued."),
  summary: z.string().trim().max(600, "Keep the summary under 600 characters."),
  body: z.string().trim().max(50000, "The main text is too long."),
  signatories: z
    .array(
      z.object({
        name: z.string().trim().min(2, "Each signatory needs a name.").max(120, "Keep names under 120 characters."),
        position: z.string().trim().max(160, "Keep positions under 160 characters."),
      }),
    )
    .max(30, "Up to 30 signatories."),
});

function readSignatories(formData: FormData) {
  try {
    const value: unknown = JSON.parse(text(formData, "signatories") || "[]");
    return Array.isArray(value) ? value.filter((row) => row && (row.name?.trim() || row.position?.trim())) : value;
  } catch {
    return null;
  }
}

function parse(formData: FormData) {
  return documentSchema.safeParse({
    kind: text(formData, "kind"),
    title: text(formData, "title"),
    reference: text(formData, "reference"),
    date: text(formData, "date"),
    summary: text(formData, "summary"),
    body: text(formData, "body"),
    signatories: readSignatories(formData),
  });
}

function refresh() {
  revalidatePath("/archive");
  revalidatePath("/archive/[id]", "page");
  revalidatePath("/portal", "layout");
}

/** Validates the Drive link field. Returns the clean link, null when left empty, or an error. */
async function readDriveLink(formData: FormData, required: boolean): Promise<{ link: string | null } | { error: FormState }> {
  const raw = text(formData, "driveLink").trim();
  const fail = (message: string) => ({ error: { error: "Check the highlighted fields.", fieldErrors: { driveLink: message } } });
  if (!raw) return required ? fail("Paste the Google Drive link to the document.") : { link: null };

  const link = normalizeDriveLink(raw);
  if (!link) return fail("Use a Google Drive file link, e.g. https://drive.google.com/file/d/…/view");
  const sharingError = await checkDriveSharing(link);
  return sharingError ? fail(sharingError) : { link };
}

export async function createDocument(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);
  const drive = await readDriveLink(formData, true);
  if ("error" in drive) return drive.error;

  await store.create("documents", { ...parsed.data, fileUrl: drive.link, fileName: null }, email, `${parsed.data.date.slice(0, 4)} ${parsed.data.reference || parsed.data.title}`);
  refresh();
  redirect("/portal/documents?notice=created");
}

export async function updateDocument(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);
  const drive = await readDriveLink(formData, false);
  if ("error" in drive) return drive.error;

  const existing = await store.get("documents", id);
  if (!existing) return { error: "This document no longer exists." };

  await store.update("documents", id, { ...parsed.data, fileUrl: drive.link, fileName: null }, email);
  // Documents uploaded before the switch to Drive links: remove the old file from Storage.
  if (existing.fileUrl !== drive.link) await deleteUpload(existing.fileUrl);
  refresh();
  redirect("/portal/documents?notice=updated");
}

export async function deleteDocument(id: string) {
  await requirePortalUser();
  const removed = await store.remove("documents", id);
  await deleteUpload(removed?.fileUrl ?? null);
  refresh();
  redirect("/portal/documents?notice=deleted");
}
