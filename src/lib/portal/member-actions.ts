"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePortalUser } from "@/lib/auth/session";
import { store } from "@/lib/data/store";
import { memberBodies, type MemberBody } from "@/lib/data/types";
import { checkUpload, deleteUpload, hasFile, saveUpload } from "@/lib/data/uploads";
import { text, toFormState, type FormState } from "./form";

const memberSchema = z.object({
  name: z.string().trim().min(2, "Add the member’s name.").max(120),
  position: z.string().trim().min(2, "Add their position.").max(120),
  body: z.enum(Object.keys(memberBodies) as [MemberBody, ...MemberBody[]], "Pick where they serve."),
  unit: z.string().trim().max(120),
  order: z.coerce.number("Use a whole number.").int("Use a whole number.").min(0).max(999),
});

function parse(formData: FormData) {
  return memberSchema.safeParse({
    name: text(formData, "name"),
    position: text(formData, "position"),
    body: text(formData, "body"),
    unit: text(formData, "unit"),
    order: text(formData, "order") || "0",
  });
}

function refresh() {
  revalidatePath("/about");
  revalidatePath("/portal", "layout");
}

async function readPhoto(formData: FormData) {
  const photo = formData.get("photo");
  if (!hasFile(photo)) return { upload: null };
  const photoError = await checkUpload(photo, "photo");
  if (photoError) return { error: { error: photoError, fieldErrors: { photo: photoError } } satisfies FormState };
  return { upload: await saveUpload(photo, "photo") };
}

export async function createMember(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);

  const photo = await readPhoto(formData);
  if (photo.error) return photo.error;

  await store.create("members", { ...parsed.data, photoUrl: photo.upload?.url ?? null }, email, `${parsed.data.body} ${parsed.data.name}`);
  refresh();
  redirect("/portal/members?notice=created");
}

export async function updateMember(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);

  const existing = await store.get("members", id);
  if (!existing) return { error: "This member no longer exists." };

  const photo = await readPhoto(formData);
  if (photo.error) return photo.error;
  const removePhoto = formData.get("removePhoto") === "on";
  const photoUrl = photo.upload?.url ?? (removePhoto ? null : existing.photoUrl);

  await store.update("members", id, { ...parsed.data, photoUrl }, email);
  if (photoUrl !== existing.photoUrl) await deleteUpload(existing.photoUrl);
  refresh();
  redirect("/portal/members?notice=updated");
}

export async function deleteMember(id: string) {
  await requirePortalUser();
  const removed = await store.remove("members", id);
  await deleteUpload(removed?.photoUrl ?? null);
  refresh();
  redirect("/portal/members?notice=deleted");
}
