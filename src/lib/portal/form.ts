import type { ZodError } from "zod";

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

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
  return typeof value === "string" ? value : "";
}
