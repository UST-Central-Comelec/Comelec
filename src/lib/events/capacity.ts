import { z } from "zod";

const limit = z.coerce.number().int("Enter a whole number.").min(1, "Enter at least 1 registrant.").max(2147483647, "Enter a smaller registrant limit.");
export const capacityFields = {
  minimumRegistrants: limit.default(1),
  maximumRegistrants: z.preprocess(value => value === "" || value === undefined ? null : value, limit.nullable()),
};
export function checkCapacity(value: { minimumRegistrants: number; maximumRegistrants: number | null }, context: z.RefinementCtx) {
  if (value.maximumRegistrants !== null && value.maximumRegistrants < value.minimumRegistrants) context.addIssue({ code: "custom", path: ["maximumRegistrants"], message: "Maximum registrants must be at least the minimum." });
}
export const capacitySchema = z.object(capacityFields).superRefine(checkCapacity);
export function readCapacity(form: FormData) {
  return { minimumRegistrants: form.has("minimumRegistrants") ? form.get("minimumRegistrants") : undefined, maximumRegistrants: form.get("maximumRegistrants") ?? null };
}
