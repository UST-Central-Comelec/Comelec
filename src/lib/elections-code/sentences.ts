import { blockText, type CodeBlock, type CodeRun } from "./usec-2011";

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

/** Split only the display; keep the document's wording and inline styles intact. */
export function sentenceBlocks(block: CodeBlock): CodeBlock[] {
  // Existing lettered or numbered items already have their own list structure.
  if (block.marker) return [block];

  const text = blockText(block);
  // Same-length substitutions keep offsets valid and prevent abbreviation boundaries.
  const protectedText = text.replace(/\b(?:[A-Za-z]\.){2,}|\b(?:Art|Par|Sec|No|Mr|Mrs|Dr)\./g,
    (abbreviation) => abbreviation.replaceAll(".", "_"));

  return Array.from(segmenter.segment(protectedText), ({ index, segment }, sentenceIndex) => {
    const end = index + segment.length;
    let offset = 0;
    const runs: CodeRun[] = [];
    for (const run of block.runs) {
      const words = typeof run === "string" ? run : run[0];
      const slice = words.slice(Math.max(0, index - offset), Math.max(0, Math.min(words.length, end - offset)));
      if (slice) runs.push(typeof run === "string" ? slice : [slice, run[1]]);
      offset += words.length;
    }
    return { level: block.level, runs, ...(sentenceIndex === 0 && block.marker ? { marker: block.marker, bold: block.bold } : {}) };
  });
}
