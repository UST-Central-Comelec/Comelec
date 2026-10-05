import { Fragment, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { describeStats, headingChanged, totalChanges, type ArticleChange, type CodeDiff, type Line, type SectionChange } from "@/lib/codes/diff";
import { articleName, sectionName } from "@/lib/codes/text";
import type { CodeBlock, CodeSection } from "@/lib/elections-code/usec-2011";
import { CodeLine } from "./code-reader";

// Free of "use client" and of server-only imports: the revision's page draws it on the server, and
// the editor draws it in the browser as the text is changed.

const kinds: Record<SectionChange["kind"], string> = { added: "Added", removed: "Removed", edited: "Edited", moved: "Moved" };
const articleKinds: Record<ArticleChange["kind"], string> = { added: "New article", removed: "Article removed", moved: "Article moved", renamed: "Article renamed" };

type Place = SectionChange["article"];

/** "Section 3 · Title", as a section's heading reads. */
const headingOf = (section: CodeSection) => [sectionName(section), section.title].filter(Boolean).join(" · ");

/** How many unchanged paragraphs are kept on either side of a change, for context. */
const CONTEXT = 1;

/** An edited section's paragraphs, with long runs of unchanged ones folded into a single line saying how many. */
function Lines({ lines }: { lines: Line[] }) {
  const shown = lines.map((line, index) => line.kind !== "same" || lines.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).some((near) => near.kind !== "same"));
  const rows: React.ReactNode[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (!shown[index]) {
      let end = index;
      while (end < lines.length && !shown[end]) end++;
      const skipped = end - index;
      rows.push(<p className="code-diff-skip" key={`skip-${index}`}>{skipped} unchanged {skipped === 1 ? "paragraph" : "paragraphs"}</p>);
      index = end - 1;
      continue;
    }
    rows.push(<DiffLine key={index} line={lines[index]} />);
  }
  return rows;
}

const levelOf = (block: CodeBlock) => ({ "--level": block.level }) as CSSProperties;

function DiffLine({ line }: { line: Line }) {
  if (line.kind !== "changed") return <div className={`code-diff-line is-${line.kind}`}><CodeLine block={line.block} /></div>;
  // The words are the same; what changed is how they're set.
  if (line.restyled) {
    return (
      <div className="code-diff-line is-restyled">
        <CodeLine block={line.block} />
        <small>{line.before.level !== line.block.level ? "Indent changed" : (line.before.marker ?? "") !== (line.block.marker ?? "") ? "Marker changed" : "Bold or italic changed"}</small>
      </div>
    );
  }
  return (
    <div className="code-diff-line is-changed">
      <div className="code-line" style={levelOf(line.block)}>
        <p>{line.words.map((word, index) => (word.kind === "same" ? <Fragment key={index}>{word.text}</Fragment> : word.kind === "added" ? <ins key={index}>{word.text}</ins> : <del key={index}>{word.text}</del>))}</p>
      </div>
    </div>
  );
}

function Change({ change }: { change: SectionChange }) {
  const renamed = change.kind === "edited" && headingChanged(change);
  const where = change.from ? `Moved here from ${articleName(change.from)}` : change.moved || change.kind === "moved" ? "Moved within its article" : null;
  const hasText = change.kind !== "moved";

  return (
    <details className={`code-change is-${change.kind}`} open={hasText}>
      <summary>
        <span className={`portal-tag code-change-tag is-${change.kind}`}>{kinds[change.kind]}</span>
        <span className="code-change-name">
          {renamed && <del>{headingOf(change.before!)}</del>}
          <strong>{headingOf(change.section)}</strong>
          {where && <small>{where}</small>}
        </span>
        {hasText && <ChevronDown className="code-chevron" size={16} aria-hidden="true" />}
      </summary>
      {hasText && (
        <div className="code-text code-diff">
          {change.kind === "edited" ? <Lines lines={change.lines ?? []} /> : change.section.blocks.map((block, index) => <DiffLine key={index} line={{ kind: change.kind === "added" ? "added" : "removed", block }} />)}
          {change.kind === "edited" && change.lines?.every((line) => line.kind === "same") && <p className="code-diff-skip">Only the heading changed.</p>}
        </div>
      )}
    </details>
  );
}

/**
 * What a revision changes, article by article: each section added, removed, edited or moved, with
 * an edited section's words marked where they were taken out and put in.
 */
export function CodeChanges({ diff }: { diff: CodeDiff }) {
  if (!totalChanges(diff.stats)) return <p className="portal-empty">Nothing differs from the published text.</p>;

  // The articles with something to show, in the order the changes come: the proposed text's, then what was removed.
  const groups = new Map<string, { place: Place; change?: ArticleChange; sections: SectionChange[] }>();
  const groupOf = (place: Place) => groups.get(place.id) ?? groups.set(place.id, { place, sections: [] }).get(place.id)!;
  for (const change of diff.sections) groupOf(change.article).sections.push(change);
  for (const change of diff.articles) groupOf(change.article).change = change;

  return (
    <div className="code-changes">
      <p className="portal-index code-changes-count">{describeStats(diff.stats)}</p>
      {[...groups.values()].map(({ place, change, sections }) => (
        <section className="code-change-group" key={place.id} aria-label={articleName(place)}>
          <header>
            <h3>{place.numeral && <span>Article {place.numeral}</span>}{place.title || "Untitled"}</h3>
            {change && <span className={`portal-tag code-change-tag is-${change.kind === "renamed" || change.kind === "moved" ? "edited" : change.kind}`}>{articleKinds[change.kind]}</span>}
            {change?.kind === "renamed" && change.before && <small>Was {[change.before.numeral && `Article ${change.before.numeral}`, change.before.title].filter(Boolean).join(" · ")}</small>}
          </header>
          {sections.map((item) => <Change key={`${item.kind}-${item.section.id}`} change={item} />)}
        </section>
      ))}
    </div>
  );
}
