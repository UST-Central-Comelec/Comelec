"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ClipboardEvent, type Dispatch, type KeyboardEvent, type RefObject } from "react";
import { ArrowDown, ArrowUp, Bold, IndentDecrease, IndentIncrease, Italic, Plus, Trash2 } from "lucide-react";
import { newKey, type Edit, type EditBlock, type EditSection } from "@/lib/codes/editing";
import { MAX_LEVEL, fromPastedLine, joinRuns, nextMarker } from "@/lib/codes/text";
import { blockText, type CodeRun } from "@/lib/elections-code/usec-2011";
import { withoutEmoji } from "@/lib/forms/input";

/** Where the cursor should land once the text is drawn again: in a paragraph's words (at a place in them, or at their end) or in its marker. */
export type Focus = { key: string; at: number | "end" | "marker" };

const escapeHtml = (value: string) => value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);

/** A paragraph's runs as the plain markup its box starts from. */
const runsHtml = (runs: CodeRun[]) =>
  runs
    .map((run) => {
      if (typeof run === "string") return escapeHtml(run);
      const text = escapeHtml(run[0]);
      return run[1] === "b" ? `<b>${text}</b>` : run[1] === "i" ? `<i>${text}</i>` : `<b><i>${text}</i></b>`;
    })
    .join("");

/** What's in a paragraph's box, or in a piece cut from it, as runs: its words with their bold and italic, and nothing else of the browser's markup. */
function readRuns(root: Node): CodeRun[] {
  const runs: CodeRun[] = [];
  const walk = (node: Node, bold: boolean, italic: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) runs.push(bold && italic ? [text, "bi"] : bold ? [text, "b"] : italic ? [text, "i"] : text);
    } else if (node instanceof HTMLElement) {
      // An emptied box is left holding a lone line break.
      if (node.tagName === "BR") return;
      const weight = node.style.fontWeight;
      const nowBold = weight === "normal" || weight === "400" ? false : bold || node.tagName === "B" || node.tagName === "STRONG" || weight === "bold" || Number(weight) >= 600;
      const nowItalic = node.style.fontStyle === "normal" ? false : italic || node.tagName === "I" || node.tagName === "EM" || node.style.fontStyle === "italic";
      node.childNodes.forEach((child) => walk(child, nowBold, nowItalic));
    } else {
      node.childNodes.forEach((child) => walk(child, bold, italic));
    }
  };
  walk(root, false, false);
  return joinRuns(runs);
}

/** Puts the cursor in a paragraph's box, `at` characters into its words or at their end. */
function placeCursor(box: HTMLElement, at: number | "end") {
  box.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(box);
  range.collapse(false);
  if (at !== "end") {
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    let left = at;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent?.length ?? 0;
      if (left <= length) {
        range.setStart(node, left);
        range.collapse(true);
        break;
      }
      left -= length;
    }
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

/** The cursor's range, if it's inside `box`. */
function rangeIn(box: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return box.contains(range.commonAncestorContainer) ? range : null;
}

/** How many characters of the box's words come before the cursor. */
function cursorOffset(box: HTMLElement, range: Range) {
  const before = range.cloneRange();
  before.selectNodeContents(box);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString().length;
}

/** What a row tells the section: all of it by the paragraph's key, so the same handlers serve every row and only a changed row is drawn again. */
type RowHandlers = {
  focus: (key: string) => void;
  change: (key: string, fields: Partial<Pick<EditBlock, "runs" | "marker" | "level">>) => void;
  split: (key: string, head: CodeRun[], tail: EditBlock) => void;
  /** `at` is how long the paragraph above is, which is where the cursor goes once the two are one. */
  join: (key: string, at: number) => void;
  paste: (key: string, blocks: EditBlock[], replace: boolean) => void;
};

/**
 * One paragraph: its marker, and its words in a box of their own. Enter starts a new paragraph
 * below (taking what's after the cursor with it), Backspace at the start joins it to the one above,
 * ⌘ or Ctrl with ] and [ moves it in and out, and with B and I sets bold and italic. What's pasted
 * comes in plain; several lines become several paragraphs.
 */
const BlockRow = memo(function BlockRow({ block, current, on }: { block: EditBlock; current: boolean; on: RowHandlers }) {
  // Only where the box starts from: afterwards its words are the browser's to change, and are read back on every keystroke.
  const [start] = useState(() => runsHtml(block.runs));
  const [empty, setEmpty] = useState(() => !blockText(block));
  const { key, level, marker } = block;

  const read = (box: HTMLElement) => {
    const runs = readRuns(box);
    setEmpty(runs.length === 0);
    on.change(key, { runs });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const box = event.currentTarget;
    const command = event.metaKey || event.ctrlKey;
    if (command && (event.key === "]" || event.key === "[")) {
      event.preventDefault();
      on.change(key, { level: level + (event.key === "]" ? 1 : -1) });
      return;
    }
    if (event.key === "Enter") {
      // A paragraph is one run of words: a line break inside it would be lost when it's saved.
      event.preventDefault();
      if (event.nativeEvent.isComposing) return;
      const range = rangeIn(box);
      if (!range) return;
      range.deleteContents();
      const rest = range.cloneRange();
      rest.selectNodeContents(box);
      rest.setStart(range.endContainer, range.endOffset);
      const tail = readRuns(rest.extractContents());
      const head = readRuns(box);
      setEmpty(head.length === 0);
      // A list carries on: "a." is followed by "b.".
      const following = nextMarker(marker);
      on.split(key, head, { key: newKey(), level, runs: tail, ...(following && { marker: following }) });
      return;
    }
    if (event.key === "Backspace") {
      const range = rangeIn(box);
      if (!range?.collapsed || cursorOffset(box, range) > 0) return;
      const above = box.closest(".code-edit-block")?.previousElementSibling?.querySelector<HTMLElement>("[data-block]");
      if (!above) return;
      event.preventDefault();
      on.join(key, above.textContent?.length ?? 0);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const lines = withoutEmoji(event.clipboardData.getData("text/plain")).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length <= 1) {
      if (lines.length) document.execCommand("insertText", false, lines[0]);
      return;
    }
    const pasted = lines.flatMap((line) => {
      const made = fromPastedLine(line, level);
      return made ? [{ ...made, key: newKey() }] : [];
    });
    // Into an empty paragraph, the lines take its place; into one with words, they follow it.
    if (pasted.length) on.paste(key, pasted, readRuns(event.currentTarget).length === 0);
  };

  return (
    <div className={`code-edit-block${current ? " is-current" : ""}`} style={{ "--level": level } as CSSProperties}>
      <input className="code-edit-marker" data-marker={key} value={marker ?? ""} placeholder="a." maxLength={24} autoComplete="off" spellCheck={false} aria-label="Marker" title="The paragraph’s marker: a., (b), 1., 5.1.1. Leave it empty for a plain paragraph." onFocus={() => on.focus(key)} onChange={(event) => on.change(key, { marker: event.target.value })} />
      <div
        className="code-edit-words"
        data-block={key}
        data-empty={empty}
        data-placeholder="Write the paragraph…"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="false"
        aria-label={marker ? `Paragraph ${marker}` : "Paragraph"}
        spellCheck
        onFocus={() => on.focus(key)}
        onInput={(event) => read(event.currentTarget)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        dangerouslySetInnerHTML={{ __html: start }}
      />
    </div>
  );
});

type ToolId = "bold" | "italic" | "out" | "in" | "up" | "down" | "remove";
type Tool = { id: ToolId; label: string; icon: typeof Bold; off?: boolean; pressed?: boolean; gap?: boolean };

/**
 * The words of one section, a paragraph to a row, under a toolbar that works on the paragraph the
 * cursor is in. `focus` is where the cursor goes after the rows are drawn again; the section's
 * number, title and place among the others are the editor's own (code-editor.tsx).
 */
export function SectionBlocks({ section, dispatch, focusRef }: { section: EditSection; dispatch: Dispatch<Edit>; focusRef: RefObject<Focus | null> }) {
  const body = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [marks, setMarks] = useState({ bold: false, italic: false });
  const { id, blocks } = section;

  // After a paragraph is added, joined or moved, the cursor follows it.
  useLayoutEffect(() => {
    const wanted = focusRef.current;
    if (!wanted) return;
    if (wanted.at === "marker") {
      const marker = body.current?.querySelector<HTMLInputElement>(`[data-marker="${wanted.key}"]`);
      if (!marker) return;
      focusRef.current = null;
      marker.focus();
      return;
    }
    const box = body.current?.querySelector<HTMLElement>(`[data-block="${wanted.key}"]`);
    if (!box) return;
    focusRef.current = null;
    placeCursor(box, wanted.at);
  });

  // Bold and Italic light up when the cursor is in words set that way.
  useEffect(() => {
    const mark = () => {
      const node = window.getSelection()?.anchorNode;
      if (!node || !body.current?.contains(node)) return;
      setMarks({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic") });
    };
    document.addEventListener("selectionchange", mark);
    return () => document.removeEventListener("selectionchange", mark);
  }, []);

  const at = blocks.findIndex((block) => block.key === current);
  const here = at === -1 ? null : blocks[at];

  // The handlers every row shares. They're the same from one drawing to the next, so only a changed row is drawn again.
  const [on] = useState((): RowHandlers => ({
    focus: (key) => setCurrent(key),
    change: (key, fields) => dispatch({ type: "block-set", section: id, key, fields }),
    split: (key, head, tail) => {
      dispatch({ type: "block-split", section: id, key, head, tail });
      focusRef.current = { key: tail.key, at: 0 };
    },
    join: (key, at) => {
      const joined = newKey();
      dispatch({ type: "block-join", section: id, key, joined });
      focusRef.current = { key: joined, at };
    },
    paste: (key, pasted, replace) => {
      dispatch({ type: "block-insert", section: id, after: key, blocks: pasted, replace });
      focusRef.current = { key: pasted.at(-1)!.key, at: "end" };
    },
  }));

  const level = (by: -1 | 1) => {
    if (here) dispatch({ type: "block-set", section: id, key: here.key, fields: { level: here.level + by } });
  };

  const add = () => {
    const key = newKey();
    const marker = nextMarker(here?.marker);
    dispatch({ type: "block-insert", section: id, after: here?.key ?? null, blocks: [{ key, level: here?.level ?? 0, runs: [], ...(marker && { marker }) }] });
    focusRef.current = { key, at: 0 };
  };

  const move = (by: -1 | 1) => {
    if (!here) return;
    dispatch({ type: "block-move", section: id, key: here.key, by });
    focusRef.current = { key: here.key, at: "end" };
  };

  const remove = () => {
    if (!here) return;
    dispatch({ type: "block-remove", section: id, key: here.key, undo: "Paragraph removed" });
    const near = blocks[at - 1] ?? blocks[at + 1];
    setCurrent(near?.key ?? null);
    if (near) focusRef.current = { key: near.key, at: "end" };
  };

  const run = (tool: ToolId) => {
    if (tool === "bold" || tool === "italic") document.execCommand(tool);
    else if (tool === "out" || tool === "in") level(tool === "in" ? 1 : -1);
    else if (tool === "up" || tool === "down") move(tool === "down" ? 1 : -1);
    else remove();
  };

  const tools: Tool[] = [
    { id: "bold", label: "Bold (⌘B)", icon: Bold, off: !here, pressed: marks.bold },
    { id: "italic", label: "Italic (⌘I)", icon: Italic, off: !here, pressed: marks.italic },
    { id: "out", label: "Move out (⌘[)", icon: IndentDecrease, off: !here || here.level === 0, gap: true },
    { id: "in", label: "Move in (⌘])", icon: IndentIncrease, off: !here || here.level === MAX_LEVEL },
    { id: "up", label: "Move the paragraph up", icon: ArrowUp, off: !here || at === 0, gap: true },
    { id: "down", label: "Move the paragraph down", icon: ArrowDown, off: !here || at === blocks.length - 1 },
    { id: "remove", label: "Remove the paragraph", icon: Trash2, off: !here, gap: true },
  ];

  return (
    <div className="code-edit-text" ref={body}>
      <div className="code-edit-tools" role="toolbar" aria-label="Paragraph">
        {tools.map(({ id: tool, label, icon: Icon, off, pressed, gap }) => (
          // The pointer mustn't take the cursor out of the paragraph the button works on.
          <button key={tool} type="button" className={gap ? "has-gap" : undefined} title={label} aria-label={label} aria-pressed={pressed} disabled={off} onMouseDown={(event) => event.preventDefault()} onClick={() => run(tool)}>
            <Icon size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        ))}
        <button type="button" className="code-edit-add" onMouseDown={(event) => event.preventDefault()} onClick={add}><Plus size={14} aria-hidden="true" /> Paragraph</button>
      </div>
      {blocks.length === 0 ? (
        <p className="code-edit-none">This section has no text yet. <button type="button" onClick={add}>Add its first paragraph.</button></p>
      ) : (
        <div className="code-edit-blocks">
          {blocks.map((block) => (
            <BlockRow key={block.key} block={block} current={block.key === current} on={on} />
          ))}
        </div>
      )}
    </div>
  );
}
