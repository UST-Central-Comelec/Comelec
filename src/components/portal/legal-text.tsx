import { parseText } from "@/lib/onboarding/documents";
import { isSerializedDocumentBody, parseDocumentBody } from "@/lib/data/document-body";
import { DocumentBody } from "@/components/document-body";

/** An onboarding document's text, as headings, paragraphs and lists (the format in src/lib/onboarding/documents.ts). */
export function LegalText({ body }: { body: string }) {
  if (isSerializedDocumentBody(body)) {
    return <div className="portal-legal-text"><DocumentBody blocks={parseDocumentBody(body)} /></div>;
  }
  return (
    <div className="portal-legal-text">
      {parseText(body).map((block, index) =>
        block.kind === "heading" ? <h3 key={index}>{block.text}</h3>
        : block.kind === "paragraph" ? <p key={index}>{block.text}</p>
        : block.kind === "bullets" ? <ul key={index}>{block.items.map((item, at) => <li key={at}>{item}</li>)}</ul>
        : <ol key={index}>{block.items.map((item, at) => <li key={at}>{item}</li>)}</ol>,
      )}
    </div>
  );
}
