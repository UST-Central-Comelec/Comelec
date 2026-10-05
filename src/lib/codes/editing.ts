// The text as the editor holds it while it's being changed (components/portal/code-editor.tsx), and
// every change the editor can make to it. Each change gives back a new text and leaves the old one
// as it was, which is what lets a removal be undone.
//
// Free of server-only imports.

import type { CodeArticle, CodeBlock, CodeRun, CodeSection } from "@/lib/elections-code/usec-2011";
import { MAX_LEVEL, joinRuns, tidyArticles, toRoman } from "./text";

/** A paragraph with a key of its own for as long as the editor is open: paragraphs have no anchor to be told apart by. */
export type EditBlock = CodeBlock & { key: string };
export type EditSection = Omit<CodeSection, "blocks"> & { blocks: EditBlock[] };
export type EditArticle = Omit<CodeArticle, "sections"> & { sections: EditSection[] };

let serial = 0;

/** A key for a paragraph added while editing. Only ever made in the browser. */
export const newKey = () => `new-${++serial}`;

/** A text as the editor holds it. The paragraphs it starts with are keyed by their place, so the server and the browser agree on them. */
export const toEditable = (articles: CodeArticle[]): EditArticle[] => articles.map((article) => ({ ...article, sections: article.sections.map((section) => ({ ...section, blocks: section.blocks.map((block, index) => ({ ...block, key: `${section.id}:${index}` })) })) }));

function stripKey(block: EditBlock): CodeBlock {
  const { level, runs, marker, bold } = block;
  return { level, runs, marker, bold };
}

/** The editor's text as it's saved: the keys dropped, and everything tidied. */
export const fromEditable = (articles: EditArticle[]): CodeArticle[] =>
  tidyArticles(articles.map((article) => ({ ...article, sections: article.sections.map((section) => ({ ...section, blocks: section.blocks.map(stripKey) })) })));

/**
 * One change to the text. `undo`, on the changes that take something away or renumber, is what the
 * editor says was done ("Section 4 removed"), beside its offer to undo it.
 */
export type Edit =
  | { type: "replace"; articles: EditArticle[] }
  | { type: "article-add"; article: EditArticle }
  | { type: "article-set"; id: string; fields: Partial<Pick<EditArticle, "numeral" | "title">> }
  | { type: "article-remove"; id: string; undo?: string }
  | { type: "article-move"; from: number; to: number }
  | { type: "articles-renumber"; undo?: string }
  | { type: "section-add"; article: string; section: EditSection }
  | { type: "section-set"; id: string; fields: Partial<Pick<EditSection, "number" | "title" | "label">> }
  | { type: "section-remove"; id: string; undo?: string }
  | { type: "section-move"; article: string; from: number; to: number }
  | { type: "section-send"; id: string; to: string; undo?: string }
  | { type: "sections-renumber"; article: string; undo?: string }
  | { type: "block-set"; section: string; key: string; fields: Partial<Pick<EditBlock, "runs" | "marker" | "level">> }
  | { type: "block-insert"; section: string; after: string | null; blocks: EditBlock[]; replace?: boolean }
  | { type: "block-remove"; section: string; key: string; undo?: string }
  | { type: "block-move"; section: string; key: string; by: -1 | 1 }
  | { type: "block-split"; section: string; key: string; head: CodeRun[]; tail: EditBlock }
  | { type: "block-join"; section: string; key: string; joined: string };

function moved<T>(list: readonly T[], from: number, to: number) {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

const inArticle = (articles: EditArticle[], id: string, change: (article: EditArticle) => EditArticle) => articles.map((article) => (article.id === id ? change(article) : article));

const inSection = (articles: EditArticle[], id: string, change: (section: EditSection) => EditSection) =>
  articles.map((article) => (article.sections.some((section) => section.id === id) ? { ...article, sections: article.sections.map((section) => (section.id === id ? change(section) : section)) } : article));

const inBlocks = (articles: EditArticle[], id: string, change: (blocks: EditBlock[]) => EditBlock[]) => inSection(articles, id, (section) => ({ ...section, blocks: change(section.blocks) }));

const clampLevel = (level: number) => Math.min(MAX_LEVEL, Math.max(0, level));

/** The text after one change. */
export function edit(articles: EditArticle[], action: Edit): EditArticle[] {
  switch (action.type) {
    case "replace":
      return action.articles;

    case "article-add":
      return [...articles, action.article];
    case "article-set":
      return inArticle(articles, action.id, (article) => ({ ...article, ...action.fields }));
    case "article-remove":
      return articles.filter((article) => article.id !== action.id);
    case "article-move":
      return moved(articles, action.from, action.to);
    case "articles-renumber": {
      // Only the articles that carry a numeral are counted: the Preamble stays as it is.
      let place = 0;
      return articles.map((article) => (article.numeral ? { ...article, numeral: toRoman(++place) } : article));
    }

    case "section-add":
      return inArticle(articles, action.article, (article) => ({ ...article, sections: [...article.sections, action.section] }));
    case "section-set":
      return inSection(articles, action.id, (section) => ({ ...section, ...action.fields }));
    case "section-remove":
      return articles.map((article) => (article.sections.some((section) => section.id === action.id) ? { ...article, sections: article.sections.filter((section) => section.id !== action.id) } : article));
    case "section-move":
      return inArticle(articles, action.article, (article) => ({ ...article, sections: moved(article.sections, action.from, action.to) }));
    case "section-send": {
      const section = articles.flatMap((article) => article.sections).find((item) => item.id === action.id);
      if (!section || !articles.some((article) => article.id === action.to)) return articles;
      return articles.map((article) => {
        const sections = article.sections.filter((item) => item.id !== action.id);
        return article.id === action.to ? { ...article, sections: [...sections, section] } : sections.length === article.sections.length ? article : { ...article, sections };
      });
    }
    case "sections-renumber": {
      // Sections named instead of numbered keep their names.
      let place = 0;
      return inArticle(articles, action.article, (article) => ({ ...article, sections: article.sections.map((section) => (section.number || !section.label ? { ...section, number: String(++place) } : section)) }));
    }

    case "block-set":
      return inBlocks(articles, action.section, (blocks) =>
        blocks.map((block) => {
          if (block.key !== action.key) return block;
          const next = { ...block, ...action.fields };
          next.level = clampLevel(next.level);
          if (!next.marker) {
            delete next.marker;
            delete next.bold;
          }
          return next;
        }),
      );
    case "block-insert":
      return inBlocks(articles, action.section, (blocks) => {
        const at = action.after === null ? -1 : blocks.findIndex((block) => block.key === action.after);
        // After a paragraph that's gone, or with none named: at the end.
        if (at === -1) return [...blocks, ...action.blocks];
        return [...blocks.slice(0, action.replace ? at : at + 1), ...action.blocks, ...blocks.slice(at + 1)];
      });
    case "block-remove":
      return inBlocks(articles, action.section, (blocks) => blocks.filter((block) => block.key !== action.key));
    case "block-move":
      return inBlocks(articles, action.section, (blocks) => {
        const from = blocks.findIndex((block) => block.key === action.key);
        return moved(blocks, from, from + action.by);
      });
    case "block-split":
      return inBlocks(articles, action.section, (blocks) => blocks.flatMap((block) => (block.key === action.key ? [{ ...block, runs: action.head }, action.tail] : [block])));
    case "block-join":
      return inBlocks(articles, action.section, (blocks) => {
        const at = blocks.findIndex((block) => block.key === action.key);
        if (at < 1) return blocks;
        const above = blocks[at - 1];
        // The paragraph above takes the words, keeps its own marker and indent, and gets a new key so the editor draws it afresh.
        return [...blocks.slice(0, at - 1), { ...above, key: action.joined, runs: joinRuns([...above.runs, ...blocks[at].runs]) }, ...blocks.slice(at + 1)];
      });
  }
}

/** The text, and the last change that can still be undone: what it was called, and the text before it. */
export type EditState = { articles: EditArticle[]; undo: { label: string; articles: EditArticle[] } | null };

/**
 * The editor's state after one change. A change that names itself (`undo`) can be taken back until
 * the next change is made; any other change lets the offer go.
 */
export function reduce(state: EditState, action: Edit | { type: "undo" }): EditState {
  if (action.type === "undo") return state.undo ? { articles: state.undo.articles, undo: null } : state;
  const label = "undo" in action ? action.undo : undefined;
  return { articles: edit(state.articles, action), undo: label ? { label, articles: state.articles } : null };
}

/** A section's place: the article it's under, and where it comes in it. */
export function findSection(articles: EditArticle[], id: string) {
  for (const article of articles) {
    const index = article.sections.findIndex((section) => section.id === id);
    if (index !== -1) return { article, section: article.sections[index], index };
  }
  return null;
}
