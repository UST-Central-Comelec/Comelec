import type { CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { articleName, sectionName } from "@/lib/codes/text";
import { blockText, type CodeArticle, type CodeBlock, type CodeRun } from "@/lib/elections-code/usec-2011";

/** A paragraph's words, with their bold and italic. */
export function CodeRuns({ runs }: { runs: CodeRun[] }) {
  return runs.map((run, index) => {
    if (typeof run === "string") return run;
    const [text, style] = run;
    if (style === "b") return <strong key={index}>{text}</strong>;
    if (style === "i") return <em key={index}>{text}</em>;
    return <strong key={index}><em>{text}</em></strong>;
  });
}

/** One paragraph of a section: as far in as the text sets it, its marker in a column of its own. */
export function CodeLine({ block }: { block: CodeBlock }) {
  return (
    <div className={`code-line${block.marker ? " has-marker" : ""}`} style={{ "--level": block.level } as CSSProperties}>
      {block.marker && <span className={`code-marker${block.bold ? " is-bold" : ""}`}>{block.marker}</span>}
      <p><CodeRuns runs={block.runs} /></p>
    </div>
  );
}

/**
 * The Constitution or the Elections Code to read in the portal: its articles listed alongside, and
 * every section an accordion, as on the website (components/elections-code/code-document.tsx).
 * Plain <details>, so the browser's own find-in-page reaches into them. `rail` is the list of
 * articles alongside, left out where there's no room for it.
 */
export function CodeReader({ articles, rail = true }: { articles: CodeArticle[]; rail?: boolean }) {
  return (
    <div className={`code-reader${rail ? "" : " is-plain"}`}>
      {rail && (
        <nav className="code-rail" aria-label="Articles">
          <p className="portal-index">Articles</p>
          <ol>
            {articles.map((article) => (
              <li key={article.id}>
                <a href={`#${article.id}`}><span>{article.numeral}</span>{article.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="code-reader-text">
        {articles.map((article) => (
          <section className="code-article" id={article.id} key={article.id} aria-labelledby={`${article.id}-title`}>
            <header className="code-article-head">
              <h2 id={`${article.id}-title`}>{article.numeral && <span>Article {article.numeral}</span>}{article.title}</h2>
              <span className="portal-index">{article.sections.length} {article.sections.length === 1 ? "section" : "sections"}</span>
            </header>
            <div className="portal-card is-flush code-sections">
              {article.sections.map((section) => (
                <details className="code-section" id={section.id} key={section.id}>
                  <summary>
                    <span className="code-number">{sectionName(section)}</span>
                    {/* Sections with no title of their own: their opening words stand in */}
                    {section.title ? <span className="code-title">{section.title}</span> : <span className="code-title is-preview">{section.blocks[0] ? blockText(section.blocks[0]) : ""}</span>}
                    <ChevronDown className="code-chevron" size={17} aria-hidden="true" />
                  </summary>
                  <div className="code-text">
                    {section.blocks.map((block, index) => <CodeLine key={index} block={block} />)}
                    <p className="code-cite">{article.numeral ? `${articleName(article)}, ${sectionName(section)}` : sectionName(section)}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
