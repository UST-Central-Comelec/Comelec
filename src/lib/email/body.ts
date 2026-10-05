// The body of an email written in the Email Sender: paragraphs and lists of text, where a stretch
// of text can be bold, italic or a link. The editor (components/portal/email-editor.tsx) reads what
// was typed into this shape, the server checks it, and the same code draws it for the preview, for
// the email and for the editor when an email is used again. No HTML from the browser is ever sent
// on: what goes out is built here, from text.
//
// Free of server-only imports.

import { z } from "zod";
import { COMMISSION, escape, link, list, paragraph, plainTitle, shell, strong, LOGO_CID } from "./template";

export type Run = { text: string; bold?: boolean; italic?: boolean; href?: string };
export type Block = { type: "paragraph"; runs: Run[] } | { type: "bullets" | "numbers"; items: Run[][] };
export type Body = Block[];

/** A link as it was typed, made whole: "ust.edu.ph" becomes "https://ust.edu.ph", an email address a mailto. Null when it can't be a link. */
export function normalizeHref(input: string) {
  const value = input.trim();
  if (!value) return null;
  const withScheme = /^(https?:|mailto:)/i.test(value) ? value : /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value) ? `mailto:${value}` : `https://${value}`;
  if (!URL.canParse(withScheme)) return null;
  const url = new URL(withScheme);
  if (url.protocol === "mailto:") return url.href;
  // A web address needs a real host: "https://hello" isn't one.
  return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? url.href : null;
}

const run = z.object({
  text: z.string().max(5000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  href: z.string().max(2000).refine((value) => normalizeHref(value) === value, "That link isn’t a web or email address.").optional(),
});
const runs = z.array(run).max(200);

export const bodySchema = z
  .array(z.discriminatedUnion("type", [z.object({ type: z.literal("paragraph"), runs }), z.object({ type: z.enum(["bullets", "numbers"]), items: z.array(runs).min(1).max(100) })]))
  .max(200);

const textOfRuns = (line: Run[]) => line.map((part) => part.text).join("");

/** Everything typed, as one string: for counting, and for telling an empty body from a written one. */
export const bodyLength = (body: Body) => body.reduce((total, block) => total + (block.type === "paragraph" ? textOfRuns(block.runs).length : block.items.reduce((sum, item) => sum + textOfRuns(item).length, 0)), 0);

export const isEmptyBody = (body: Body) => body.every((block) => (block.type === "paragraph" ? !textOfRuns(block.runs).trim() : block.items.every((item) => !textOfRuns(item).trim())));

type Marks = { strong: (html: string) => string; em: (html: string) => string; a: (href: string, html: string) => string };

const inline = (line: Run[], marks: Marks) =>
  line
    .map((part) => {
      let html = escape(part.text).replace(/\n/g, "<br>");
      if (part.bold) html = marks.strong(html);
      if (part.italic) html = marks.em(html);
      if (part.href) html = marks.a(part.href, html);
      return html;
    })
    .join("");

const emailMarks: Marks = {
  strong,
  em: (html) => `<em>${html}</em>`,
  a: link,
};

/** The body as the email's blocks. */
export const bodyBlocks = (body: Body) =>
  body.map((block) => (block.type === "paragraph" ? paragraph(inline(block.runs, emailMarks)) : list(block.items.map((item) => inline(item, emailMarks)), block.type === "numbers")));

const plainRuns = (line: Run[]) => line.map((part) => (part.href && part.href.replace(/^mailto:/, "") !== part.text.trim() ? `${part.text} (${part.href.replace(/^mailto:/, "")})` : part.text)).join("");

/** The body as plain text, for mail apps that don't show HTML. */
export const bodyText = (body: Body) =>
  body.map((block) => (block.type === "paragraph" ? plainRuns(block.runs) : block.items.map((item, index) => `${block.type === "numbers" ? `${index + 1}.` : "•"} ${plainRuns(item)}`).join("\n"))).join("\n\n");

const editorMarks: Marks = { strong: (html) => `<b>${html}</b>`, em: (html) => `<i>${html}</i>`, a: (href, html) => `<a href="${escape(href)}">${html}</a>` };

/** The body as the plain markup the editor works on, to start it from an email written before. */
export const bodyEditorHtml = (body: Body) =>
  body
    .map((block) => {
      if (block.type === "paragraph") return `<p>${inline(block.runs, editorMarks)}</p>`;
      const tag = block.type === "numbers" ? "ol" : "ul";
      return `<${tag}>${block.items.map((item) => `<li>${inline(item, editorMarks)}</li>`).join("")}</${tag}>`;
    })
    .join("");

/** Who an email from the Email Sender is from: their unit heads the email, and replies go to them. */
export type Sender = { name: string; email: string; unit: string };

export type Message = { subject: string; title: string; body: Body };

/** An email from the Email Sender, as HTML. `logoSrc` is set by the preview, which shows the seal from the website. */
export function messageHtml(message: Message, sender: Sender, logoSrc = `cid:${LOGO_CID}`) {
  return shell({
    eyebrow: sender.unit,
    title: message.title.trim() || undefined,
    blocks: bodyBlocks(message.body),
    preheader: bodyText(message.body).replace(/\s+/g, " ").slice(0, 140),
    logoSrc,
  });
}

export function messageText(message: Message) {
  return [message.title.trim() && plainTitle(message.title.trim()), bodyText(message.body), COMMISSION].filter(Boolean).join("\n\n");
}
