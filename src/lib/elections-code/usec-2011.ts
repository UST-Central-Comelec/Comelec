import data from "./usec-2011.json";

// The UST Students' Election Code of 2011, as it was signed. usec-2011.json is the text of the
// signed PDF (public/documents/USEC-2011.pdf), article by article, word for word: its typos and its
// repeated "Section 2" under Article IV are the Code's own.
//
// This is where the Elections Code starts from. Once a revision is approved in the portal
// (Publications → Elections Code), the page reads the approved text instead: src/lib/codes/store.ts.

/** A stretch of text, plain or set in bold ("b"), italic ("i") or both ("bi"). */
export type CodeRun = string | [text: string, style: "b" | "i" | "bi"];

/** A paragraph or a list item. `level` is how far in it sits; `marker` is its "a.", "(b)" or "5.1.1". */
export type CodeBlock = { level: number; runs: CodeRun[]; marker?: string; bold?: boolean };

/**
 * One section of an article. `id` is its anchor on the page, and stays with it wherever it's moved.
 * Some sections have no title, and the Constitution's Preamble has no number: `label` names it instead.
 */
export type CodeSection = { id: string; number: string | null; title: string | null; blocks: CodeBlock[]; label?: string };

/**
 * An article and its sections. `id` is its anchor on the page. The Preamble, which is not an
 * article, has no numeral. `number` is its place in the text as it was signed.
 */
export type CodeArticle = { id: string; number: number; numeral: string | null; title: string; sections: CodeSection[] };

/** The files hold no article ids: an article's anchor has always been "article-" and its number. */
export const withArticleIds = (articles: Array<Omit<CodeArticle, "id">>): CodeArticle[] => articles.map((article) => ({ id: `article-${article.number}`, ...article }));

export const usec2011 = withArticleIds(data as Array<Omit<CodeArticle, "id">>);

/** The signed copy, for download. */
export const usecPdf = "/documents/USEC-2011.pdf";

/** A block's words alone, without their styling. */
export const blockText = (block: CodeBlock) => block.runs.map((run) => (typeof run === "string" ? run : run[0])).join("");
