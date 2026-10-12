import type { ZodError } from "zod";
import { withoutEmoji } from "@/lib/forms/input";
import type { EditConflict } from "./edit-conflict";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; conflict?: EditConflict } | undefined;

export function toFormState(error: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    fieldErrors[field] ??= issue.message;
  }
  return { error: "Check the highlighted fields.", fieldErrors };
}

export function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? withoutEmoji(value) : "";
}
