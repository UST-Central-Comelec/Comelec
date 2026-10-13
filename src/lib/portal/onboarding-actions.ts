"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireEditor } from "@/lib/auth/session";
import { isOnboardingDocumentKey, TEXT_LIMITS } from "@/lib/onboarding/documents";
import { saveOnboardingDocument } from "@/lib/onboarding/store";
import { createAdminClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import { documentBodyText, isSerializedDocumentBody, parseDocumentBody } from "@/lib/data/document-body";
import { text, toFormState, type FormState } from "./form";

// Legals → Documents → Onboarding: saving a document adds its next version. Requesters see it from
// their next step; anyone who already accepted keeps the version they were shown.

const schema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(TEXT_LIMITS.title, `Keep the title within ${TEXT_LIMITS.title} characters.`),
  statement: z.string().trim().min(1, "Enter what the requester agrees to.").max(TEXT_LIMITS.statement, `Keep it within ${TEXT_LIMITS.statement} characters.`),
  body: z.string().trim().min(1, "Enter the document’s text.").max(TEXT_LIMITS.body, "This text is too long.")
    .refine(value => !value.startsWith("::document-body:v1::") || isSerializedDocumentBody(value), "The formatting couldn’t be read. Edit the text and try again.")
    .refine(value => documentBodyText(parseDocumentBody(value)).trim().length > 0, "Enter the document’s text."),
});

type StepChange = { operation: "move"; key: string; direction: -1 | 1 } | { operation: "visibility"; key: string; visible: boolean } | { operation: "delete"; key: string };
const needsStepMigration = (code: string) => ["PGRST202", "42883", "42P01", "PGRST205"].includes(code);
const stepMigrationMessage = "Onboarding steps can’t be changed yet. Run supabase/migrations/0084_onboarding_step_controls.sql first.";

export async function changeOnboardingStep(change: StepChange): Promise<{ error?: string }> {
  const user = await requireEditor("legals/onboarding");
  if (!isOnboardingDocumentKey(change.key) || change.key === "privacy-notice") return { error: "Steps 0 and 1 are locked." };
  try {
    const { error } = await createAdminClient().rpc("change_onboarding_step", {
      operation: change.operation, step_key: change.key, author: user.email,
      direction: change.operation === "move" ? change.direction : 0,
      visible: change.operation === "visibility" ? change.visible : true,
    });
    if (error) return { error: needsStepMigration(error.code) ? stepMigrationMessage : "Couldn’t change the step. Reload and try again." };
  } catch {
    return { error: "Couldn’t change the step. Try again." };
  }
  revalidatePath("/portal/legals/onboarding", "layout");
  revalidatePath("/portal/login");
  return {};
}

export async function createOnboardingDocument(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("legals/onboarding");
  const parsed = schema.safeParse({ title: text(formData, "title"), statement: text(formData, "statement"), body: text(formData, "body").replace(/\r\n?/g, "\n") });
  if (!parsed.success) return toFormState(parsed.error);
  const key = `custom-${randomUUID()}`;
  try {
    const { error } = await createAdminClient().rpc("change_onboarding_step", { operation: "add", step_key: key, author: user.email, document_text: parsed.data });
    if (error) return { error: needsStepMigration(error.code) ? stepMigrationMessage : "Couldn’t add the step. Try again." };
  } catch {
    return { error: "Couldn’t add the step. Try again." };
  }
  revalidatePath("/portal/legals/onboarding");
  revalidatePath("/portal/login");
  redirect("/portal/legals/onboarding?notice=onboarding-step-added");
}

export async function updateOnboardingDocument(key: string, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("legals/onboarding");
  if (!isOnboardingDocumentKey(key)) return { error: "This document no longer exists." };
  // The body keeps its line breaks; `text` only strips emoji.
  const parsed = schema.safeParse({ title: text(formData, "title"), statement: text(formData, "statement"), body: text(formData, "body").replace(/\r\n?/g, "\n") });
  if (!parsed.success) return toFormState(parsed.error);

  let result: Awaited<ReturnType<typeof saveOnboardingDocument>>;
  try {
    result = await saveOnboardingDocument(key, parsed.data, user.email);
  } catch {
    return { error: "Couldn’t save the document. Try again." };
  }
  if (result === "missing-table") return { error: "Onboarding documents can’t be saved yet. Run supabase/migrations/0074_onboarding_declarations.sql first." };

  revalidatePath("/portal/legals/onboarding");
  revalidatePath("/portal/login");
  redirect(`/portal/legals/onboarding?notice=${result === "saved" ? "onboarding-document-saved" : "onboarding-document-unchanged"}`);
}
