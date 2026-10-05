import { z } from "zod";
import { bodyLength, isEmptyBody, normalizeHref, type Body, type Run } from "@/lib/email/body";

// Keep legacy plain text readable while storing new formatting in the existing text column.
const PREFIX = "event-background:v1:";
const run = z.object({
  text: z.string().max(10000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  href: z.string().max(2000).refine((value) => normalizeHref(value) === value, "Use a valid web or email address.").optional(),
});
const runs = z.array(run).max(1000);
const blocks = z.array(z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), runs }),
  z.object({ type: z.literal("bullets"), items: z.array(runs).max(1000) }),
])).max(1000);

function decode(value: string): Body {
  return blocks.parse(JSON.parse(value.slice(PREFIX.length)));
}

export function readBackground(value: string): Body {
  if (value.startsWith(PREFIX)) {
    try { return decode(value); } catch { /* Unrecognized content remains plain text. */ }
  }
  return value.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ type: "paragraph", runs: [{ text }] }));
}

export function writeBackground(body: Body): string {
  if (isEmptyBody(body)) return "";
  // Only the supported formatting is kept, including when the browser inserts other markup.
  const cleanRuns = (parts: Run[]) => parts.map(({ text, bold, italic, href }) => ({ text, ...(bold && { bold }), ...(italic && { italic }), ...(href && { href }) }));
  return PREFIX + JSON.stringify(body.map((block) => block.type === "paragraph"
    ? { type: "paragraph", runs: cleanRuns(block.runs) }
    : { type: "bullets", items: block.items.map(cleanRuns) }));
}

export const backgroundSchema = z.string().trim().max(200000, "The background is too long.").superRefine((value, context) => {
  try {
    const body = value.startsWith(PREFIX) ? decode(value) : readBackground(value);
    if (bodyLength(body) > 10000) context.addIssue({ code: "custom", message: "Keep the background under 10,000 characters." });
  } catch {
    context.addIssue({ code: "custom", message: "The background formatting is invalid. Please edit it and try again." });
  }
});
