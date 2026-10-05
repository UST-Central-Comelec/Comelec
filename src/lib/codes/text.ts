// The text of the Constitution or the Elections Code as a revision carries it: its shape, checked;
// the tidying every save goes through; and what the editor needs to name and number things.
//
// Free of server-only imports: the editor (components/portal/code-editor.tsx) tidies and checks
// with the same code the server does.

import { z } from "zod";
import { blockText, type CodeArticle, type CodeBlock, type CodeRun, type CodeSection } from "@/lib/elections-code/usec-2011";

/** How far in a paragraph can sit. */
export const MAX_LEVEL = 5;

const anchor = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
const run = z.union([z.string().max(6000), z.tuple([z.string().max(6000), z.enum(["b", "i", "bi"])])]);
const block = z.object({ level: z.number().int().min(0).max(MAX_LEVEL), runs: z.array(run).max(300), marker: z.string().max(24).optional(), bold: z.boolean().optional() });
const section = z.object({ id: anchor, number: z.string().max(16).nullable(), title: z.string().max(240).nullable(), label: z.string().max(80).optional(), blocks: z.array(block).max(400) });
const article = z.object({ id: anchor, number: z.number().int().min(0).max(999), numeral: z.string().max(16).nullable(), title: z.string().max(240), sections: z.array(section).max(250) });

/** A text's shape, as the server accepts it from the editor. */
export const articlesSchema = z.array(article).max(150);

/** What a browser puts in for a typed space, a tab or a line break: all of them are a space here. */
const plain = (text: string) => text.replace(/[ \t\r\n]/g, " ");

const styleOf = (part: CodeRun) => (typeof part === "string" ? "" : part[1]);
const textOf = (part: CodeRun) => (typeof part === "string" ? part : part[0]);
const toRun = (text: string, style: string): CodeRun => (style ? [text, style as "b" | "i" | "bi"] : text);

/** A paragraph's runs with neighbours of the same style joined and nothing empty. Spaces at either end are kept: the editor works on these. */
export function joinRuns(runs: CodeRun[]): CodeRun[] {
  const joined: Array<{ text: string; style: string }> = [];
  for (const part of runs) {
    const text = plain(textOf(part));
    if (!text) continue;
    const last = joined.at(-1);
    if (last && last.style === styleOf(part)) last.text += text;
    else joined.push({ text, style: styleOf(part) });
  }
  return joined.map((part) => toRun(part.text, part.style));
}

/** A paragraph's runs as they're saved: joined, with no space at either end. */
export function tidyRuns(runs: CodeRun[]): CodeRun[] {
  const joined = joinRuns(runs).map((part) => ({ text: textOf(part), style: styleOf(part) }));
  if (joined.length) {
    joined[0].text = joined[0].text.trimStart();
    joined[joined.length - 1].text = joined[joined.length - 1].text.trimEnd();
  }
  return joined.filter((part) => part.text).map((part) => toRun(part.text, part.style));
}

function tidyBlock(source: CodeBlock): CodeBlock | null {
  const runs = tidyRuns(source.runs);
  if (!runs.length) return null;
  const marker = plain(source.marker ?? "").trim();
  return { level: Math.min(MAX_LEVEL, Math.max(0, Math.trunc(source.level) || 0)), runs, ...(marker && { marker }), ...(marker && source.bold && { bold: true }) };
}

const word = (text: string | null | undefined) => plain(text ?? "").replace(/ {2,}/g, " ").trim();

function tidySection(source: CodeSection): CodeSection {
  const number = word(source.number) || null;
  const label = word(source.label);
  return {
    id: source.id,
    number,
    title: word(source.title) || null,
    blocks: source.blocks.map(tidyBlock).filter((item): item is CodeBlock => item !== null),
    // A name stands in for the number, so one with a number has no use for it.
    ...(label && !number && { label }),
  };
}

/**
 * A text as it's saved: headings trimmed, runs joined, empty paragraphs dropped. An article's
 * `number` is its place among the articles. Text that needs none of this comes out as it went in,
 * so a section nobody touched never shows as changed.
 */
export function tidyArticles(articles: CodeArticle[]): CodeArticle[] {
  return articles.map((source, index) => ({ id: source.id, number: index + 1, numeral: word(source.numeral) || null, title: word(source.title), sections: source.sections.map(tidySection) }));
}

/** "Article IV", or the title of one that isn't numbered ("Preamble"). */
export const articleName = (item: Pick<CodeArticle, "numeral" | "title">) => (item.numeral ? `Article ${item.numeral}` : item.title || "Untitled");

/** "Section 3", or the name of one that isn't numbered ("Preamble"). */
export const sectionName = (item: Pick<CodeSection, "number" | "label">) => item.label ?? (item.number ? `Section ${item.number}` : "Section");

export const countSections = (articles: CodeArticle[]) => articles.reduce((total, item) => total + item.sections.length, 0);

/** Every anchor in the text, articles' and sections'. */
const anchorsOf = (articles: CodeArticle[]) => articles.flatMap((item) => [item.id, ...item.sections.map((part) => part.id)]);

/** Whether every article and section has an anchor of its own. */
export function hasUniqueAnchors(articles: CodeArticle[]) {
  const anchors = anchorsOf(articles);
  return new Set(anchors).size === anchors.length;
}

/**
 * What stops a text from being sent for approval, in words for its editors: an article with no
 * title or no sections, a section with nothing to call it, or one with no text. A draft may be
 * saved with any of these.
 */
export function problemsIn(articles: CodeArticle[]): string[] {
  if (!articles.length) return ["Add at least one article."];
  const problems: string[] = [];
  articles.forEach((item, index) => {
    const name = item.title ? articleName(item) : `The ${ordinal(index + 1)} article`;
    if (!item.title) problems.push(`${name} needs a title.`);
    if (!item.sections.length) problems.push(`${name} has no sections.`);
    item.sections.forEach((part, place) => {
      const called = part.number || part.label ? sectionName(part) : `The ${ordinal(place + 1)} section`;
      if (!part.number && !part.label) problems.push(`${called} of ${name} needs a number or a name.`);
      if (!part.blocks.some((line) => blockText(line).trim())) problems.push(`${called} of ${name} has no text.`);
    });
  });
  return problems;
}

function ordinal(place: number) {
  const tens = place % 100;
  const suffix = tens > 10 && tens < 14 ? "th" : (["th", "st", "nd", "rd"][place % 10] ?? "th");
  return `${place}${suffix}`;
}

const numerals: Array<[number, string]> = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

/** 4 as "IV". */
export function toRoman(value: number) {
  let left = Math.max(1, Math.trunc(value));
  let roman = "";
  for (const [amount, letters] of numerals) {
    while (left >= amount) {
      roman += letters;
      left -= amount;
    }
  }
  return roman;
}

/** "IV" as 4. Null when it isn't a numeral written the usual way. */
export function fromRoman(text: string) {
  const letters = text.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(letters)) return null;
  let left = letters;
  let value = 0;
  for (const [amount, mark] of numerals) {
    while (left.startsWith(mark)) {
      value += amount;
      left = left.slice(mark.length);
    }
  }
  return toRoman(value) === letters ? value : null;
}

/** The numeral the next article would take: one more than the last numbered article's. */
export function nextNumeral(articles: Array<Pick<CodeArticle, "numeral">>) {
  const last = articles.map((item) => (item.numeral ? fromRoman(item.numeral) : null)).findLast((value) => value !== null);
  return toRoman((last ?? articles.filter((item) => item.numeral).length) + 1);
}

/** The number the next section would take: one more than the last numbered section's. */
export function nextNumber(sections: Array<Pick<CodeSection, "number">>) {
  const last = sections.map((part) => Number.parseInt(part.number ?? "", 10)).findLast((value) => Number.isFinite(value));
  return String((last ?? 0) + 1);
}

/**
 * The marker that follows `marker` in a list: "a." then "b.", "(c)" then "(d)", "2)" then "3)",
 * "5.1.1" then "5.1.2", "II." then "III.". Null when it isn't one that counts.
 */
export function nextMarker(marker: string | undefined) {
  const parts = marker?.match(/^(\(?)([A-Za-z]+|\d+(?:\.\d+)*)([.)]?)$/);
  if (!parts) return null;
  const [, open, core, close] = parts;
  if (/^\d/.test(core)) {
    const numbers = core.split(".");
    numbers[numbers.length - 1] = String(Number(numbers.at(-1)) + 1);
    return `${open}${numbers.join(".")}${close}`;
  }
  // A lone letter is a letter ("h." then "i."), unless it's a capital that only a numeral would be ("I." then "II.").
  const roman = core.length > 1 || /^[IVX]$/.test(core) ? fromRoman(core) : null;
  if (roman !== null) {
    const next = toRoman(roman + 1);
    return `${open}${core === core.toLowerCase() ? next.toLowerCase() : next}${close}`;
  }
  if (core.length !== 1 || /[zZ]/.test(core)) return null;
  return `${open}${String.fromCharCode(core.charCodeAt(0) + 1)}${close}`;
}

/** A marker at the start of a pasted line: "a.", "(b)", "1)", "5.1.1", "IV.". */
const pastedMarker = /^(\(?(?:[A-Za-z]|[ivxlc]{2,5}|[IVXLC]{2,5}|\d{1,3}(?:\.\d{1,3})*)[.)]|\d{1,2}(?:\.\d{1,3})+)\s+(?=\S)/;

/** A pasted line as a paragraph: its marker, if it starts with one, and the rest as its text. */
export function fromPastedLine(line: string, level: number): CodeBlock | null {
  const text = plain(line).trim();
  if (!text) return null;
  const marker = text.match(pastedMarker)?.[1];
  return marker ? { level, runs: [text.slice(marker.length).trimStart()], marker } : { level, runs: [text] };
}

const BASE36 = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A new anchor: "section-k3f9x2ab". Random, so two editors adding sections never collide. */
export function newAnchor(prefix: "article" | "section") {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}-${[...bytes].map((byte) => BASE36[byte % BASE36.length]).join("")}`;
}
