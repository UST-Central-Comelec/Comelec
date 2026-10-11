"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { codes, isCodeKey, type CodeKey } from "@/lib/codes/options";
import { saveCodeVisibility } from "@/lib/codes/settings";
import { tabHref } from "./access";
import { text, type FormState } from "./form";

export async function updateCodeVisibility(code: CodeKey, _state: FormState, formData: FormData): Promise<FormState> {
  if (!isCodeKey(code)) return { error: "Unknown document." };
  const user = await requireEditor(codes[code].tab);
  const visibility = text(formData, "visibility");
  if (visibility !== "published" && visibility !== "hidden") return { error: "Choose Publish or Hide." };
  try {
    await saveCodeVisibility(code, visibility, user.email);
  } catch (error) {
    console.error("Couldn’t save document settings:", error);
    return { error: "Couldn’t save the settings. Check that supabase/migrations/0049_code_settings.sql has been applied, then try again." };
  }
  revalidatePath("/", "layout");
  redirect(`${tabHref(codes[code].tab)}?show=settings&notice=code-settings-saved`);
}
