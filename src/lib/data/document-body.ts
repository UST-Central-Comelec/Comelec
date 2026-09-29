// Turns a document's pasted main text into paragraphs and tables. Used by the public document page
// and the portal's preview, so what commissioners preview is exactly what gets published.
//
// Tables: copying a table from Google Docs, Word or Google Sheets and pasting it into a plain text
// box gives one line per row with a tab between cells. Two or more such lines in a row become a
// table; the first line is its header.

export type BodyBlock = { type: "paragraph"; text: string } | { type: "table"; header: string[]; rows: string[][] };

const isTableLine = (line: string) => line.includes("\t") && line.replace(/\t/g, "").trim() !== "";

export function parseDocumentBody(text: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let table: string[][] = [];

  const flushParagraph = () => {
    const joined = paragraph.join("\n").trim();
    if (joined) blocks.push({ type: "paragraph", text: joined });
    paragraph = [];
  };
  const flushTable = () => {
    if (table.length >= 2) {
      let width = Math.max(...table.map((row) => row.length));
      // Some apps add a trailing tab to every row; drop columns that are empty everywhere.
      while (width > 1 && table.every((row) => !row[width - 1])) width--;
      table = table.map((row) => row.slice(0, width));
      const [header, ...rows] = table.map((row) => [...row, ...Array(width - row.length).fill("")]);
      blocks.push({ type: "table", header, rows });
    } else if (table.length === 1) {
      // A single tab-separated line isn't a table — keep it as text.
      paragraph.push(table[0].join("  "));
    }
    table = [];
  };

  for (const line of lines) {
    if (isTableLine(line)) {
      flushParagraph();
      table.push(line.split("\t").map((cell) => cell.trim()));
    } else if (line.trim() === "") {
      flushTable();
      flushParagraph();
    } else {
      flushTable();
      paragraph.push(line);
    }
  }
  flushTable();
  flushParagraph();
  return blocks;
}
