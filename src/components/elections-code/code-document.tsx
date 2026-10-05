import type { CSSProperties, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { CodeTools } from "@/components/elections-code/code-tools";
import { CopyLink } from "@/components/news/copy-link";
import { sectionName } from "@/lib/codes/text";
import { blockText, type CodeArticle, type CodeBlock, type CodeRun } from "@/lib/elections-code/usec-2011";

function Run({ run }: { run: CodeRun }) {
  if (typeof run === "string") return run;
  const [text, style] = run;
  if (style === "b") return <strong>{text}</strong>;
  if (style === "i") return <em>{text}</em>;
  return <strong><em>{text}</em></strong>;
}

function Block({ block }: { block: CodeBlock }) {
  return (
    <div className={`ec-block${block.marker ? " has-marker" : ""}`} style={{ "--level": block.level } as CSSProperties}>
      {block.marker && <span className={`ec-marker${block.bold ? " is-bold" : ""}`}>{block.marker}</span>}
      <p>{block.runs.map((run, index) => <Run key={index} run={run} />)}</p>
    </div>
  );
}

/**
 * A governing document to read on the page (the Elections Code, the Constitution): its articles
 * listed alongside, a toolbar to search it, open everything or take the PDF, and every section an
 * accordion. `articles` is the published text (src/lib/codes/store.ts): as it was signed, or as the
 * latest revision approved in the portal has it. An article's and a section's `id` is its anchor,
 * which stays with it however the text is rearranged. `name` is what the search calls the document
 * ("Code", "Constitution"); the children are the note at its foot. Styled by
 * src/app/(site)/elections-code/elections-code.css.
 */
export function CodeDocument({ articles, pdf, name, children }: { articles: CodeArticle[]; pdf: string; name: string; children: ReactNode }) {
  const sections = articles.reduce((total, article) => total + article.sections.length, 0);

  return (
    <div className="bp-wrap bp-body ec-layout">
      <nav className="ec-nav" aria-label="Articles">
        <p>Articles</p>
        <ol>
          {articles.map((article) => (
            <li key={article.id}>
              <a href={`#${article.id}`}><span>{article.numeral}</span>{article.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="ec-main">
        <CodeTools pdf={pdf} total={sections} name={name} />
        <div id="ec-code">
          {articles.map((article) => (
            <section className="ec-article" id={article.id} key={article.id} aria-labelledby={`${article.id}-title`}>
              <header className="bp-head">
                <h2 id={`${article.id}-title`}>{article.numeral && <span>Article {article.numeral}</span>}{article.title}</h2>
                <i aria-hidden="true" />
                <p>{article.sections.length} {article.sections.length === 1 ? "section" : "sections"}</p>
              </header>
              <div className="ec-sections">
                {article.sections.map((section) => (
                  <details className="ec-section" id={section.id} key={section.id}>
                    <summary>
                      <span className="ec-number">{sectionName(section)}</span>
                      {/* Sections with no title of their own: their opening words stand in */}
                      {section.title ? <span className="ec-title">{section.title}</span> : <span className="ec-title is-preview">{section.blocks[0] ? blockText(section.blocks[0]) : ""}</span>}
                      <ChevronDown className="ec-chevron" size={18} aria-hidden="true" />
                    </summary>
                    <div className="ec-text">
                      {section.blocks.map((block, index) => <Block key={index} block={block} />)}
                      <p className="ec-cite">
                        <span>{article.numeral ? `Article ${article.numeral}, ${sectionName(section)}` : sectionName(section)}</span>
                        <CopyLink className="ec-copy" hash={section.id} />
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="ec-none" id="ec-none" hidden>No section of the {name} has those words. Try another, or a shorter one.</p>
        <p className="ec-note">{children}</p>
      </div>
    </div>
  );
}
