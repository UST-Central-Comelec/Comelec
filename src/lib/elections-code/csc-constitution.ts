import data from "./csc-constitution.json";
import { withArticleIds, type CodeArticle } from "./usec-2011";

// The Student Government Constitution of the University of Santo Tomas, as the PDF has it.
// csc-constitution.json is the text of the PDF (public/documents/CSC-Constitution.pdf), word for
// word, from the Preamble to Article XX; the Foreword is left to the PDF. Articles are numbered by
// their place: the PDF prints the first as "ARTICLE 1" and the nineteenth as "ARTICLE IX".
//
// This is where the Constitution starts from. Once a revision is approved in the portal
// (Publications → Constitution), the page reads the approved text instead: src/lib/codes/store.ts.

export const cscConstitution = withArticleIds(data as Array<Omit<CodeArticle, "id">>);

/** The copy to download. */
export const constitutionPdf = "/documents/CSC-Constitution.pdf";
