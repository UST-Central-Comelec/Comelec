// What a revision changes: the text as proposed set against the published text it was started
// from. Sections and articles are followed by their anchors, so one that's renumbered, retitled or
// moved is still known as itself, and its words are compared with what they were.
//
// Free of server-only imports: the editor counts its changes as they're made, and the revision's
// page draws them, with the same code.

import { blockText, type CodeArticle, type CodeBlock, type CodeSection } from "@/lib/elections-code/usec-2011";

/** How much a revision changes: sections added, removed, edited and moved, and articles added, removed, renamed or moved. */
export type ChangeStats = { added: number; removed: number; edited: number; moved: number; articles: number };

export const noChanges: ChangeStats = { added: 0, removed: 0, edited: 0, moved: 0, articles: 0 };

export const totalChanges = (stats: ChangeStats) => stats.added + stats.removed + stats.edited + stats.moved + stats.articles;

/** "3 sections edited · 1 added · 1 article changed", or "No changes". */
export function describeStats(stats: ChangeStats) {
  const kinds: Array<[number, string]> = [[stats.edited, "edited"], [stats.added, "added"], [stats.removed, "removed"], [stats.moved, "moved"]];
  // The first part names what's counted: "2 sections added", then just "1 removed".
  const parts = kinds.filter(([value]) => value > 0).map(([value, verb], index) => (index === 0 ? `${value} ${value === 1 ? "section" : "sections"} ${verb}` : `${value} ${verb}`));
  if (stats.articles) parts.push(`${stats.articles} ${stats.articles === 1 ? "article" : "articles"} changed`);
  return parts.join(" · ") || "No changes";
}

/** A stretch of a paragraph's words: as they were, taken out, or put in. */
export type Word = { text: string; kind: "same" | "added" | "removed" };

/**
 * One paragraph of an edited section. `changed` is a paragraph reworded in place, with its words
 * marked; `restyled` is one whose words are the same and whose indent, marker or bold and italic
 * aren't.
 */
export type Line =
  | { kind: "same" | "added" | "removed"; block: CodeBlock }
  | { kind: "changed"; before: CodeBlock; block: CodeBlock; words: Word[]; restyled: boolean };

type Place = Pick<CodeArticle, "id" | "numeral" | "title">;

/**
 * What happened to one section. `section` is how it stands now (how it stood, for one removed) and
 * `article` the article it's under (it was under). `before` is how it stood, for one edited or
 * moved; `from` is the article it left, when it changed articles; `moved` says an edited section
 * was also moved; `lines` are an edited section's paragraphs, old and new.
 */
export type SectionChange = {
  kind: "added" | "removed" | "edited" | "moved";
  section: CodeSection;
  article: Place;
  before?: CodeSection;
  from?: Place;
  moved?: boolean;
  lines?: Line[];
};

/** What happened to one article itself, apart from its sections: added, removed, moved among the articles, or given a new numeral or title. */
export type ArticleChange = { kind: "added" | "removed" | "moved" | "renamed"; article: Place; before?: Place };

export type CodeDiff = { stats: ChangeStats; articles: ArticleChange[]; sections: SectionChange[] };

/** The most cells a comparison may fill. Past this, two lists are simply shown as one taken out and one put in. */
const MAX_CELLS = 4_000_000;

/**
 * The longest run of items the two lists share, in order, as pairs of their places. What lies
 * between the pairs was taken out of `before` or put into `after`.
 */
function matches<T>(before: readonly T[], after: readonly T[], same: (a: T, b: T) => boolean): Array<[number, number]> {
  const rows = before.length;
  const columns = after.length;
  if (!rows || !columns || rows * columns > MAX_CELLS) return [];
  const width = columns + 1;
  const table = new Uint16Array((rows + 1) * width);
  for (let row = rows - 1; row >= 0; row--) {
    for (let column = columns - 1; column >= 0; column--) {
      table[row * width + column] = same(before[row], after[column]) ? table[(row + 1) * width + column + 1] + 1 : Math.max(table[(row + 1) * width + column], table[row * width + column + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  for (let row = 0, column = 0; row < rows && column < columns; ) {
    if (same(before[row], after[column])) pairs.push([row++, column++]);
    else if (table[(row + 1) * width + column] >= table[row * width + column + 1]) row++;
    else column++;
  }
  return pairs;
}

/** The items that left their place among the others: those outside the longest run that kept its order. */
function displaced(before: readonly string[], after: readonly string[]) {
  const kept = new Set(after);
  const shared = before.filter((id) => kept.has(id));
  const was = new Set(shared);
  const now = after.filter((id) => was.has(id));
  const inOrder = new Set(matches(shared, now, (a, b) => a === b).map(([row]) => shared[row]));
  return new Set(shared.filter((id) => !inOrder.has(id)));
}

const sameRuns = (a: CodeBlock, b: CodeBlock) => a.runs.length === b.runs.length && a.runs.every((part, index) => {
  const other = b.runs[index];
  return typeof part === "string" || typeof other === "string" ? part === other : part[0] === other[0] && part[1] === other[1];
});

const sameBlock = (a: CodeBlock, b: CodeBlock) => a.level === b.level && (a.marker ?? "") === (b.marker ?? "") && Boolean(a.bold) === Boolean(b.bold) && sameRuns(a, b);

const sameHeading = (a: CodeSection, b: CodeSection) => a.number === b.number && a.title === b.title && (a.label ?? "") === (b.label ?? "");

const sameSection = (a: CodeSection, b: CodeSection) => sameHeading(a, b) && a.blocks.length === b.blocks.length && a.blocks.every((line, index) => sameBlock(line, b.blocks[index]));

/** A paragraph as one line of words, its marker first. */
export const lineText = (block: CodeBlock) => (block.marker ? `${block.marker} ${blockText(block)}` : blockText(block));

/** A paragraph's words, each with the space after it, so two versions are compared word by word and never space by space. */
const tokens = (text: string) => text.match(/\S+\s*/g) ?? [];

/** Two versions of a paragraph, word by word: the stretches kept, taken out and put in. Null when they share too little to be read as one paragraph reworded. */
function wordsOf(before: string, after: string): Word[] | null {
  const was = tokens(before);
  const now = tokens(after);
  const kept = matches(was, now, (a, b) => a.trimEnd() === b.trimEnd());
  if (kept.length * 2 < Math.max(was.length, now.length)) return null;
  const words: Word[] = [];
  const push = (text: string, kind: Word["kind"]) => {
    if (!text) return;
    const last = words.at(-1);
    if (last?.kind === kind) last.text += text;
    else words.push({ text, kind });
  };
  let row = 0;
  let column = 0;
  for (const [nextRow, nextColumn] of [...kept, [was.length, now.length] as [number, number]]) {
    push(was.slice(row, nextRow).join(""), "removed");
    push(now.slice(column, nextColumn).join(""), "added");
    if (nextColumn < now.length) push(now[nextColumn], "same");
    row = nextRow + 1;
    column = nextColumn + 1;
  }
  return words;
}

/** An edited section's paragraphs: those kept, taken out, put in, and reworded in place. */
function linesOf(before: CodeBlock[], after: CodeBlock[]): Line[] {
  const lines: Line[] = [];
  let row = 0;
  let column = 0;
  for (const [nextRow, nextColumn] of [...matches(before, after, sameBlock), [before.length, after.length] as [number, number]]) {
    const out = before.slice(row, nextRow);
    const into = after.slice(column, nextColumn);
    // Paragraphs taken out and put in at the same spot are taken as the same paragraphs, reworded,
    // where they still share most of their words. Otherwise one was taken out and another put in.
    const paired = Math.min(out.length, into.length);
    for (let index = 0; index < paired; index++) {
      const words = wordsOf(lineText(out[index]), lineText(into[index]));
      if (words) lines.push({ kind: "changed", before: out[index], block: into[index], words, restyled: words.every((part) => part.kind === "same") });
      else lines.push({ kind: "removed", block: out[index] }, { kind: "added", block: into[index] });
    }
    for (const block of out.slice(paired)) lines.push({ kind: "removed", block });
    for (const block of into.slice(paired)) lines.push({ kind: "added", block });
    if (nextRow < before.length) lines.push({ kind: "same", block: after[nextColumn] });
    row = nextRow + 1;
    column = nextColumn + 1;
  }
  return lines;
}

const placeOf = ({ id, numeral, title }: CodeArticle): Place => ({ id, numeral, title });

/**
 * Everything `after` changes in `before`. Sections come in the order of the proposed text, each
 * removed one where it used to stand; `lines` is left out when `detail` is false, for when only
 * the counts are wanted.
 */
export function diffArticles(before: CodeArticle[], after: CodeArticle[], detail = true): CodeDiff {
  const wasArticle = new Map(before.map((item) => [item.id, item]));
  const nowArticle = new Map(after.map((item) => [item.id, item]));
  const wasSection = new Map(before.flatMap((item) => item.sections.map((part) => [part.id, { part, under: item }] as const)));
  const nowSection = new Map(after.flatMap((item) => item.sections.map((part) => [part.id, { part, under: item }] as const)));

  const movedArticles = displaced(before.map((item) => item.id), after.map((item) => item.id));
  const articles: ArticleChange[] = [];
  for (const item of after) {
    const was = wasArticle.get(item.id);
    if (!was) articles.push({ kind: "added", article: placeOf(item) });
    else if (was.numeral !== item.numeral || was.title !== item.title) articles.push({ kind: "renamed", article: placeOf(item), before: placeOf(was) });
    else if (movedArticles.has(item.id)) articles.push({ kind: "moved", article: placeOf(item) });
  }
  for (const item of before) if (!nowArticle.has(item.id)) articles.push({ kind: "removed", article: placeOf(item) });

  const sections: SectionChange[] = [];
  const removedFrom = (item: CodeArticle) => item.sections.filter((part) => !nowSection.has(part.id)).map((part): SectionChange => ({ kind: "removed", section: part, article: placeOf(item) }));

  for (const item of after) {
    const was = wasArticle.get(item.id);
    const outOfOrder = was ? displaced(was.sections.map((part) => part.id), item.sections.map((part) => part.id)) : new Set<string>();
    for (const part of item.sections) {
      const old = wasSection.get(part.id);
      if (!old) {
        sections.push({ kind: "added", section: part, article: placeOf(item) });
        continue;
      }
      const from = old.under.id === item.id ? undefined : placeOf(old.under);
      const moved = Boolean(from) || outOfOrder.has(part.id);
      if (!sameSection(old.part, part)) sections.push({ kind: "edited", section: part, before: old.part, article: placeOf(item), from, moved, ...(detail && { lines: linesOf(old.part.blocks, part.blocks) }) });
      else if (moved) sections.push({ kind: "moved", section: part, before: old.part, article: placeOf(item), from });
    }
    if (was) sections.push(...removedFrom(was));
  }
  for (const item of before) if (!nowArticle.has(item.id)) sections.push(...removedFrom(item));

  const count = (kind: SectionChange["kind"]) => sections.filter((change) => change.kind === kind).length;
  return { articles, sections, stats: { added: count("added"), removed: count("removed"), edited: count("edited"), moved: count("moved"), articles: articles.length } };
}

/** Only the counts. */
export const countChanges = (before: CodeArticle[], after: CodeArticle[]) => diffArticles(before, after, false).stats;

/** An edited section's heading changed, apart from its text. */
export const headingChanged = (change: SectionChange) => Boolean(change.before) && !sameHeading(change.before!, change.section);
