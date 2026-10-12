"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireEditor } from "@/lib/auth/session";
import { isOnboardingDocumentKey, TEXT_LIMITS } from "@/lib/onboarding/documents";
import { saveOnboardingDocument } from "@/lib/onboarding/store";
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
  redirect(`/portal/legals/onboarding?notice=${result === "saved" ? "onboarding-document-saved" : "onboarding-document-unchanged"}`);
}
