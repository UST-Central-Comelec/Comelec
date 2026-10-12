import { isSerializedDocumentBody, serializeDocumentBody, type RichBodyBlock } from "@/lib/data/document-body";
import { parseText } from "./documents";

/** Open older onboarding text in the shared editor without exposing its formatting markers. */
export function editableOnboardingBody(body: string): string {
  if (isSerializedDocumentBody(body)) return body;
  const blocks = parseText(body).map((block): RichBodyBlock => {
    if (block.kind === "bullets" || block.kind === "numbers") {
      return { type: block.kind, items: block.items.map(text => [{ text, fontSize: 14 }]) };
    }
    return { type: "text", runs: [{ text: block.text, fontSize: block.kind === "heading" ? 14.5 : 14, ...(block.kind === "heading" && { bold: true }) }] };
  });
  return serializeDocumentBody(blocks);
}
