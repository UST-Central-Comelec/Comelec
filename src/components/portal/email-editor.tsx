"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Unlink } from "lucide-react";
import { normalizeHref, type Body, type Run } from "@/lib/email/body";
import { withoutEmoji } from "@/lib/forms/input";

type Marks = Pick<Run, "bold" | "italic" | "href">;

const BLOCKS = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"]);

const sameMarks = (a: Marks, b: Marks) => Boolean(a.bold) === Boolean(b.bold) && Boolean(a.italic) === Boolean(b.italic) && a.href === b.href;

/** The marks an element adds to the text inside it. */
function marksOf(element: HTMLElement, marks: Marks): Marks {
  const next = { ...marks };
  const weight = element.style.fontWeight;
  if (element.tagName === "B" || element.tagName === "STRONG" || weight === "bold" || Number(weight) >= 600) next.bold = true;
  if (element.tagName === "I" || element.tagName === "EM" || element.style.fontStyle === "italic") next.italic = true;
  if (element.tagName === "A") next.href = normalizeHref(element.getAttribute("href") ?? "") ?? undefined;
  return next;
}

function add(line: Run[], text: string, marks: Marks) {
  const last = line.at(-1);
  if (last && sameMarks(last, marks)) last.text += text;
  else line.push({ text, ...(marks.bold && { bold: true }), ...(marks.italic && { italic: true }), ...(marks.href && { href: marks.href }) });
}

/** A line with the space around it trimmed off; empty when there's nothing but space. */
function tidy(line: Run[]) {
  if (!line.some((part) => part.text.trim())) return [];
  line[0].text = line[0].text.trimStart();
  line[line.length - 1].text = line[line.length - 1].text.trimEnd();
  return line.filter((part) => part.text);
}

/** Text and its marks, from `node` down, as one line. A line break inside it is kept. */
function readInline(node: Node, marks: Marks, line: Run[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    // The browser keeps typed spaces as non-breaking ones.
    const text = (node.textContent ?? "").replace(/ /g, " ");
    if (text) add(line, text, marks);
  } else if (node instanceof HTMLElement) {
    if (node.tagName === "BR") return add(line, "\n", {});
    const next = marksOf(node, marks);
    node.childNodes.forEach((child) => readInline(child, next, line));
  }
}

/** What's in the editor, as the email's body: its paragraphs and lists, with nothing of the browser's markup kept. */
export function readBody(root: HTMLElement): Body {
  const body: Body = [];
  let line: Run[] = [];
  const flush = () => {
    const runs = tidy(line);
    line = [];
    if (runs.length) body.push({ type: "paragraph", runs });
  };
  const walk = (node: Node, marks: Marks) => {
    if (!(node instanceof HTMLElement)) return readInline(node, marks, line);
    if (node.tagName === "UL" || node.tagName === "OL") {
      flush();
      const items = [...node.children]
        .map((item) => {
          const runs: Run[] = [];
          item.childNodes.forEach((child) => readInline(child, marks, runs));
          return tidy(runs);
        })
        .filter((item) => item.length);
      if (items.length) body.push({ type: node.tagName === "OL" ? "numbers" : "bullets", items });
    } else if (BLOCKS.has(node.tagName) || node.querySelector("p, div, ul, ol")) {
      flush();
      const next = marksOf(node, marks);
      node.childNodes.forEach((child) => walk(child, next));
      flush();
    } else readInline(node, marks, line);
  };
  root.childNodes.forEach((child) => walk(child, {}));
  flush();
  return body;
}

/** The link the selection is in, if it's inside `root`. */
function linkAt(root: HTMLElement) {
  const node = window.getSelection()?.anchorNode;
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  const link = element?.closest("a");
  return link && root.contains(link) ? link : null;
}

type Format = "bold" | "italic" | "insertUnorderedList" | "insertOrderedList";

/**
 * The Email Sender's message box: text with bold, italic, links, and bulleted or numbered lists.
 * What's typed is read into the email's body (`onChange`), which is what the server gets; pasted
 * text comes in plain. Ctrl/⌘ + B, I and K work.
 */
export function EmailEditor({ initialHtml, onChange, labelledBy, invalid, numberedLists = true, placeholder = "Write your message…" }: { initialHtml: string; onChange: (body: Body) => void; labelledBy: string; invalid?: boolean; numberedLists?: boolean; placeholder?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  // Only where the editor starts from: afterwards the box is the browser's to change. An empty one
  // starts with a paragraph, so the first line typed is one like the rest.
  const [start] = useState(initialHtml || "<p><br></p>");
  const [empty, setEmpty] = useState(!initialHtml);
  const [active, setActive] = useState<Record<Format | "link", boolean>>({ bold: false, italic: false, insertUnorderedList: false, insertOrderedList: false, link: false });
  const [linking, setLinking] = useState<{ href: string; error: boolean } | null>(null);

  useEffect(() => {
    // Enter starts a new paragraph, as it would in a mail app.
    document.execCommand("defaultParagraphSeparator", false, "p");
    const mark = () => {
      const root = box.current;
      const selection = window.getSelection();
      if (!root || !selection?.anchorNode || !root.contains(selection.anchorNode)) return;
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
        link: Boolean(linkAt(root)),
      });
    };
    document.addEventListener("selectionchange", mark);
    return () => document.removeEventListener("selectionchange", mark);
  }, []);

  useEffect(() => {
    if (linking) linkInput.current?.focus();
  }, [linking]);

  const changed = () => {
    const root = box.current;
    if (!root) return;
    const body = readBody(root);
    setEmpty(body.length === 0 && !root.querySelector("li"));
    onChange(body);
  };

  const format = (command: Format) => {
    box.current?.focus();
    document.execCommand(command);
    changed();
  };

  /** Back to where the cursor was before the link box took the focus. */
  const restore = () => {
    box.current?.focus();
    const selection = window.getSelection();
    if (saved.current && selection) {
      selection.removeAllRanges();
      selection.addRange(saved.current);
    }
  };

  const openLink = () => {
    const root = box.current;
    const selection = window.getSelection();
    if (!root) return;
    if (!selection?.rangeCount || !root.contains(selection.anchorNode)) {
      // Nothing picked in the message yet: the link goes at its end.
      const end = document.createRange();
      end.selectNodeContents(root);
      end.collapse(false);
      saved.current = end;
    } else saved.current = selection.getRangeAt(0).cloneRange();
    setLinking({ href: linkAt(root)?.getAttribute("href") ?? "", error: false });
  };

  const applyLink = () => {
    if (!linking) return;
    const href = normalizeHref(linking.href);
    if (!href) return setLinking({ ...linking, error: true });
    restore();
    const existing = box.current ? linkAt(box.current) : null;
    if (existing) existing.setAttribute("href", href);
    else if (window.getSelection()?.isCollapsed) {
      // No words were selected, so the address itself becomes the link's text.
      const link = document.createElement("a");
      link.href = href;
      link.textContent = linking.href.trim();
      document.execCommand("insertHTML", false, link.outerHTML);
    } else document.execCommand("createLink", false, href);
    setLinking(null);
    changed();
  };

  const removeLink = () => {
    restore();
    const existing = box.current ? linkAt(box.current) : null;
    if (existing) {
      // The whole link, wherever in it the cursor is.
      const range = document.createRange();
      range.selectNodeContents(existing);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    document.execCommand("unlink");
    setLinking(null);
    changed();
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    document.execCommand("insertText", false, withoutEmoji(event.clipboardData.getData("text/plain")));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openLink();
    }
  };

  const tools: Array<{ command: Format; label: string; icon: typeof Bold }> = [
    { command: "bold", label: "Bold", icon: Bold },
    { command: "italic", label: "Italic", icon: Italic },
    { command: "insertUnorderedList", label: "Bulleted list", icon: List },
    { command: "insertOrderedList", label: "Numbered list", icon: ListOrdered },
  ];

  return (
    <div className={`email-editor${invalid ? " is-invalid" : ""}`}>
      <div className="email-editor-tools" role="toolbar" aria-label="Formatting">
        {tools.filter(({ command }) => numberedLists || command !== "insertOrderedList").map(({ command, label, icon: Icon }, index) => (
          <button key={command} type="button" className={index === 2 ? "has-gap" : undefined} title={label} aria-label={label} aria-pressed={active[command]} onMouseDown={(event) => event.preventDefault()} onClick={() => format(command)}>
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        ))}
        <button type="button" className="has-gap" title="Link" aria-label="Link" aria-pressed={active.link} aria-expanded={Boolean(linking)} onMouseDown={(event) => event.preventDefault()} onClick={openLink}>
          <Link2 size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {linking && (
        <div className="email-editor-link">
          <input
            ref={linkInput}
            className="portal-input"
            type="url"
            inputMode="url"
            placeholder="https://… or an email address"
            aria-label="Link address"
            aria-invalid={linking.error}
            value={linking.href}
            onChange={(event) => setLinking({ href: event.target.value, error: false })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              } else if (event.key === "Escape") {
                setLinking(null);
                restore();
              }
            }}
          />
          <button type="button" className="portal-button is-small" onClick={applyLink}>Apply</button>
          {active.link && <button type="button" className="portal-button is-ghost is-small" onClick={removeLink}><Unlink size={13} aria-hidden="true" /> Remove</button>}
          <button type="button" className="portal-button is-ghost is-small" onClick={() => { setLinking(null); restore(); }}>Cancel</button>
          {linking.error && <span className="portal-field-error" role="alert">That isn’t a web or email address.</span>}
        </div>
      )}
      <div
        ref={box}
        className="email-editor-box"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-invalid={invalid || undefined}
        data-empty={empty}
        data-placeholder={placeholder}
        onInput={changed}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        dangerouslySetInnerHTML={{ __html: start }}
      />
    </div>
  );
}
