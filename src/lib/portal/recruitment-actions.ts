"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePortalUser } from "@/lib/auth/session";
import { positions } from "@/lib/applications/options";
import { saveSlots } from "@/lib/applications/slots";
import { text, type FormState } from "./form";

export async function updateRecruitmentSlots(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();

  const counts: Record<string, number> = {};
  const fieldErrors: Record<string, string> = {};
  for (const position of positions) {
    const raw = text(formData, `slots-${position.id}`).trim() || "0";
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0 || value > 999) fieldErrors[`slots-${position.id}`] = "Use a whole number from 0 to 999.";
    else counts[position.id] = value;
  }
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  try {
    await saveSlots(counts, email);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the slots." };
  }

  revalidatePath("/apply");
  revalidatePath("/portal/recruitment");
  redirect("/portal/recruitment?notice=slots-saved");
}
