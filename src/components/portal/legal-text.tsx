import type { ReactNode } from "react";
import { documentLayoutStyle, isSerializedDocumentBody, normalizeDocumentHref, parseDocumentBody, type BodyBlock, type DocumentRun } from "@/lib/data/document-body";
import { editableOnboardingBody } from "@/lib/onboarding/body";
import { DocumentBody } from "@/components/document-body";

// An onboarding document's text, laid out to be read: numbered sections under headings, each set off
// by a hairline, the opening paragraph as a lead, and the points that matter picked out as it's drawn.
// Both formats come through here: the light text format (src/lib/onboarding/documents.ts) is read
// into the shared editor's blocks first, so a saved version and version 1 look the same.

type Mark = "term" | "key" | "rule" | "signer";

/** How a declaration names whoever signs it; shown as their name once it's known. */
const SIGNER = /\bthe Member named in this onboarding\b/g;

/**
 * What's picked out in plain runs, without touching the words: defined terms (“the Member”) and
 * laws in bold; time limits underlined; what's forbidden in bold and underlined.
 */
const MARKS: [RegExp, Mark][] = [
  [/“(?:the |together, )?[A-Z][^”]{1,48}”/g, "term"],
  [/\bRepublic Act No\. \d+/g, "term"],
  [/\b(?:[a-z]+(?:-[a-z]+)? \(\d+\)|\d+) (?:school |calendar |working |academic )?(?:days?|weeks?|months?|years?|hours?)(?:’)?\b/gi, "key"],
  [/\b(?:must not|may not|will not|shall not|cannot|never|No Member may)\b/g, "rule"],
];

function marked(text: string, signer?: string): { text: string; mark?: Mark }[] {
  const hits: { start: number; end: number; mark: Mark }[] = [];
  for (const [pattern, mark] of signer ? [[SIGNER, "signer"] as [RegExp, Mark], ...MARKS] : MARKS) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (!hits.some((hit) => start < hit.end && end > hit.start)) hits.push({ start, end, mark });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const parts: { text: string; mark?: Mark }[] = [];
  let at = 0;
  for (const hit of hits) {
    if (hit.start > at) parts.push({ text: text.slice(at, hit.start) });
    parts.push({ text: text.slice(hit.start, hit.end), mark: hit.mark });
    at = hit.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

/** A run as written; plain runs get their key points picked out. Sizes follow the reader, not the editor. */
function Runs({ runs, signer }: { runs: DocumentRun[]; signer?: string }) {
  return runs.map((run, index) => {
    const plain = !run.bold && !run.italic && !run.underline && !run.href;
    let content: ReactNode = plain
      ? marked(run.text, signer).map((part, at) => part.mark === "signer" ? <u key={at} className="legal-signer">{signer}</u> : part.mark ? <strong key={at} className={`legal-${part.mark}`}>{part.text}</strong> : part.text)
      : run.text;
    if (run.bold) content = <strong>{content}</strong>;
    if (run.italic) content = <em>{content}</em>;
    if (run.underline) content = <u>{content}</u>;
    const href = run.href && normalizeDocumentHref(run.href);
    if (href) content = <a href={href}>{content}</a>;
    return <span key={index} style={run.color ? { color: run.color } : undefined}>{content}</span>;
  });
}

const textOf = (runs: DocumentRun[]) => runs.map((run) => run.text).join("").trim();

/** A line set wholly in bold, and short, is a heading. */
function headingOf(block: BodyBlock): string | null {
  if (block.type !== "text") return null;
  const text = textOf(block.runs);
  return text && text.length <= 140 && block.runs.every((run) => run.bold || !run.text.trim()) ? text : null;
}

function Heading({ text }: { text: string }) {
  const numbered = /^(\d+|[IVX]+)[.)]\s+(.+)$/.exec(text);
  return numbered
    ? <h3><span className="legal-number" aria-hidden="true">{numbered[1]}</span><span><span className="portal-visually-hidden">{numbered[1]}. </span>{numbered[2]}</span></h3>
    : <h3><span>{text}</span></h3>;
}

function Block({ block, lead, signer }: { block: BodyBlock; lead: boolean; signer?: string }) {
  if (block.type === "text") {
    const text = textOf(block.runs);
    if (!text) return null;
    const className = lead ? "legal-lead" : text.endsWith(":") ? "legal-lead-in" : undefined;
    return <p className={className} style={documentLayoutStyle(block)}><Runs runs={block.runs} signer={signer} /></p>;
  }
  if (block.type === "bullets" || block.type === "numbers") {
    const Tag = block.type === "numbers" ? "ol" : "ul";
    return <Tag start={block.type === "numbers" ? block.start : undefined} style={documentLayoutStyle(block)}>{block.items.map((item, at) => <li key={at}><Runs runs={item} signer={signer} /></li>)}</Tag>;
  }
  return <DocumentBody blocks={[block]} />;
}

/** `signer` is the name of whoever is reading it to sign, put in where a declaration names the Member. */
export function LegalText({ body, signer }: { body: string; signer?: string }) {
  const blocks = parseDocumentBody(isSerializedDocumentBody(body) ? body : editableOnboardingBody(body));
  // Split into the opening (before the first heading) and one section per heading.
  const sections: { heading: string | null; blocks: BodyBlock[] }[] = [{ heading: null, blocks: [] }];
  for (const block of blocks) {
    const heading = headingOf(block);
    if (heading) sections.push({ heading, blocks: [] });
    else if (block.type !== "divider") sections.at(-1)!.blocks.push(block);
  }
  const firstText = sections[0]!.blocks.find((block) => block.type === "text" && textOf(block.runs));
  return (
    <div className="portal-legal-text">
      {sections.map((section, index) => (!section.heading && !section.blocks.length) ? null : (
        <section key={index} className={section.heading ? "legal-section" : "legal-opening"}>
          {section.heading && <Heading text={section.heading} />}
          {section.blocks.map((block, at) => <Block key={at} block={block} lead={block === firstText} signer={signer} />)}
        </section>
      ))}
    </div>
  );
}
