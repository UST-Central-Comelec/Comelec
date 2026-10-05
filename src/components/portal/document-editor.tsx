"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent, type ComponentProps } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Unlink, AlignLeft, AlignCenter, AlignRight, AlignJustify, IndentIncrease, IndentDecrease, Check, ChevronDown, Minus, Plus, Table2, TableCellsMerge, TableCellsSplit, Trash2, PaintBucket } from "lucide-react";
import { DOCUMENT_DEFAULT_FONT_SIZE, documentBodyHtml, normalizeDocumentColor, normalizeDocumentFontSize, normalizeDocumentHref, parseDocumentBody, serializeDocumentBody } from "@/lib/data/document-body";
import { readDocumentEditor } from "@/lib/data/document-editor";
import { documentTableCells, documentTableGrid, mergeDocumentTableCells, resizeDocumentTable, splitDocumentTableCell } from "@/lib/data/document-table";

type Format = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "justifyLeft" | "justifyCenter" | "justifyRight" | "justifyFull" | "indent" | "outdent";
const tools = [
  { command: "bold", label: "Bold", icon: Bold },
  { command: "italic", label: "Italic", icon: Italic },
  { command: "underline", label: "Underline", icon: Underline },
  { command: "insertUnorderedList", label: "Bullet points", icon: List },
  { command: "insertOrderedList", label: "Numbered list", icon: ListOrdered },
] as const;
const layoutTools = [
  { command: "justifyLeft", label: "Align left", icon: AlignLeft },
  { command: "justifyCenter", label: "Align center", icon: AlignCenter },
  { command: "justifyRight", label: "Align right", icon: AlignRight },
  { command: "justifyFull", label: "Justify text", icon: AlignJustify },
  { command: "outdent", label: "Decrease indent", icon: IndentDecrease },
  { command: "indent", label: "Increase indent", icon: IndentIncrease },
] as const;
const commandState = () => Object.fromEntries([...tools, ...layoutTools].map(({ command }) => [command, document.queryCommandState(command)]));
const ribbonIconSize = 14;
const fontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

// The same ten-column palette used by Docs: neutrals, vivid colors, then six shades.
const colorRows = [
  ["#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff"],
  ["#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff"],
  ["#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc"],
  ["#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd"],
  ["#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0"],
  ["#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79"],
  ["#85200c", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#0b5394", "#351c75", "#741b47"],
  ["#5b0f00", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#1c4587", "#073763", "#20124d", "#4c1130"],
];

function swatchInk(color: string) {
  const [r, g, b] = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  return r * .299 + g * .587 + b * .114 > 150 ? "#000000" : "#ffffff";
}

function RibbonButton({ label, children, ...props }: ComponentProps<"button"> & { label: string }) {
  return <span className="document-tool" data-tooltip={label}><button type="button" aria-label={label} onMouseDown={event => event.preventDefault()} {...props}>{children}</button></span>;
}

function ColorPalette({ label, color, onSelect, clearable = false }: { label: string; color: string; onSelect: (value: string) => void; clearable?: boolean }) {
  return <div className="document-color-palette" role="dialog" aria-label={`${label} palette`}>
    <div className="document-color-grid">
      {colorRows.flat().map(value => <button key={value} type="button" className="document-color-swatch" style={{ backgroundColor: value, color: swatchInk(value) }} aria-label={`${label} ${value}`} title={value} aria-pressed={color === value} onMouseDown={event => event.preventDefault()} onClick={() => onSelect(value)}>{color === value && <Check size={ribbonIconSize} aria-hidden="true" />}</button>)}
    </div>
    {clearable && <button type="button" className="document-color-clear" onMouseDown={event => event.preventDefault()} onClick={() => onSelect("")}>No fill</button>}
  </div>;
}

export function DocumentEditor({ initialBody, onChange, labelledBy, invalid, readOnly = false }: {
  initialBody: string; onChange: (body: string) => void; labelledBy: string; invalid?: boolean; readOnly?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const ribbon = useRef<HTMLDivElement>(null);
  const [ribbonPanel, setRibbonPanel] = useState<"color" | "cellColor" | "alignment" | null>(null);
  const saved = useRef<Range | null>(null);
  const selectedTable = useRef<HTMLTableElement | null>(null);
  // Keep the initialization object stable so draft/toolbar updates never overwrite the browser's edits.
  const [initialMarkup] = useState(() => ({ __html: documentBodyHtml(parseDocumentBody(initialBody)) || "<p><br></p>" }));
  const [active, setActive] = useState<Partial<Record<Format, boolean>>>({});
  const [tableSettings, setTableSettings] = useState<{ rows: string; columns: string; header: boolean; editing: boolean } | null>(null);
  const [tableError, setTableError] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);
  const [linking, setLinking] = useState<{ href: string; error: boolean; existing: boolean } | null>(null);
  const [color, setColor] = useState("#000000");
  const [cellColor, setCellColor] = useState("");
  const [fontSize, setFontSize] = useState(DOCUMENT_DEFAULT_FONT_SIZE);
  const pendingFontSize = useRef<number | null>(null);
  const cellAnchor = useRef<HTMLTableCellElement | null>(null);
  const drag = useRef<{ cell: HTMLTableCellElement; selecting: boolean } | null>(null);
  const [tableContext, setTableContext] = useState(false);
  const pickedCells = useRef<HTMLTableCellElement[]>([]);
  const [cellSelection, setCellSelection] = useState({ count: 0, canSplit: false });

  useEffect(() => {
    const update = () => {
      const root = box.current;
      const selection = window.getSelection();
      if (!root || !selection?.anchorNode || !root.contains(selection.anchorNode)) return;
      if (pickedCells.current.length > 1) return;
      saved.current = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const anchor = selection.anchorNode instanceof HTMLElement ? selection.anchorNode : selection.anchorNode.parentElement;
      const cell = anchor?.closest<HTMLTableCellElement>("td, th");
      selectedTable.current = cell?.closest("table") ?? null;
      setTableContext(Boolean(cell));
      if (pickedCells.current[0] !== cell) selectCells(cell ? [cell] : []);
      setActive(commandState());
      setColor(normalizeDocumentColor(String(document.queryCommandValue("foreColor"))) ?? "#000000");
      let element = selection.anchorNode instanceof HTMLElement ? selection.anchorNode : selection.anchorNode.parentElement;
      let size: number | null = null;
      while (element && element !== root && !size) { size = normalizeDocumentFontSize(element.style.fontSize); element = element.parentElement; }
      setFontSize(size ?? (document.queryCommandValue("fontSize") === "7" ? pendingFontSize.current : null) ?? normalizeDocumentFontSize(getComputedStyle(root).fontSize) ?? DOCUMENT_DEFAULT_FONT_SIZE);
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);
  useEffect(() => {
    if (!ribbonPanel) return;
    const dismiss = (event: PointerEvent) => {
      if (!ribbon.current?.contains(event.target as Node)) setRibbonPanel(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [ribbonPanel]);
  useEffect(() => { if (linking) linkInput.current?.focus(); }, [linking]);

  const changed = () => {
    if (box.current) {
      if (pendingFontSize.current) for (const font of box.current.querySelectorAll<HTMLElement>('font[size="7"]')) {
        font.style.fontSize = `${pendingFontSize.current}px`;
        font.removeAttribute("size");
      }
      onChange(serializeDocumentBody(readDocumentEditor(box.current)));
    }
  };

  function restore() {
    const root = box.current;
    if (!root) return;
    root.focus();
    const selection = window.getSelection();
    let range = saved.current;
    if (!range || !root.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
    }
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function format(command: Format) {
    if (formatCells(command)) return;
    restore();
    document.execCommand(command);
    changed();
    setActive(commandState());
  }

  function insertHorizontalLine() {
    const root = box.current;
    if (!root) return;
    setRibbonPanel(null);
    restore();
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    let container = (node instanceof HTMLElement ? node : node?.parentElement)?.closest("table, ul, ol");
    // A divider separates document sections, so place it after an enclosing table or list.
    if (container && root.contains(container)) {
      let outer = container.parentElement?.closest("table, ul, ol");
      while (outer && root.contains(outer)) {
        container = outer;
        outer = container.parentElement?.closest("table, ul, ol");
      }
      const range = document.createRange();
      range.setStartAfter(container);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    document.execCommand("insertHTML", false, '<hr class="document-divider"><p><br></p>');
    changed();
  }

  function linkAt() {
    const node = saved.current?.startContainer;
    const element = node instanceof HTMLElement ? node : node?.parentElement;
    const link = element?.closest("a");
    return link && box.current?.contains(link) ? link : null;
  }

  function openLink() {
    setRibbonPanel(null);
    setTableSettings(null);
    const existing = linkAt();
    setLinking({ href: existing?.getAttribute("href") ?? "", error: false, existing: Boolean(existing) });
  }

  function applyLink() {
    if (!linking) return;
    const href = normalizeDocumentHref(linking.href);
    if (!href) { setLinking({ ...linking, error: true }); return; }
    if (formatCells("createLink", href)) { setLinking(null); return; }
    const existing = linkAt();
    restore();
    if (existing) {
      const range = document.createRange();
      range.selectNodeContents(existing);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
    if (window.getSelection()?.isCollapsed) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = linking.href.trim();
      document.execCommand("insertHTML", false, link.outerHTML);
    } else document.execCommand("createLink", false, href);
    setLinking(null);
    changed();
  }

  function removeLink() {
    if (formatCells("unlink")) { setLinking(null); return; }
    const existing = linkAt();
    restore();
    if (existing) {
      const range = document.createRange();
      range.selectNodeContents(existing);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
    document.execCommand("unlink");
    setLinking(null);
    changed();
  }

  function changeColor(value: string) {
    if (formatCells("foreColor", value)) { setColor(value); return; }
    restore();
    document.execCommand("foreColor", false, value);
    setColor(value);
    changed();
  }

  function changeFontSize(value: number) {
    if (formatCells("fontSize", String(value))) { setFontSize(value); return; }
    restore();
    pendingFontSize.current = value;
    document.execCommand("fontSize", false, "7");
    setFontSize(value);
    changed();
  }

  function selectCells(cells: HTMLTableCellElement[]) {
    for (const cell of pickedCells.current) cell.removeAttribute("data-document-selected");
    pickedCells.current = cells;
    const colors = cells.map(cell => normalizeDocumentColor(cell.style.backgroundColor) ?? "");
    setCellColor(colors.length && colors.every(value => value === colors[0]) ? colors[0] : "");
    if (cells.length > 1) for (const cell of cells) cell.setAttribute("data-document-selected", "true");
    setCellSelection({ count: cells.length, canSplit: cells.length === 1 && (cells[0].rowSpan > 1 || cells[0].colSpan > 1) });
  }

  function cellMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (readOnly || event.button !== 0) return;
    pendingFontSize.current = null;
    const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>("td, th");
    if (!cell || !box.current?.contains(cell)) { selectCells([]); cellAnchor.current = null; setTableContext(false); return; }
    selectedTable.current = cell.closest("table");
    setTableContext(true);
    setTableError("");
    cellAnchor.current = cell;
    selectCells([cell]);
    drag.current = { cell, selecting: false };
  }

  useEffect(() => {
    const move = (event: globalThis.MouseEvent) => {
      const current = drag.current;
      const root = box.current;
      if (!current || !root) return;
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLTableCellElement>("td, th");
      if (!cell || !root.contains(cell) || cell.closest("table") !== current.cell.closest("table")) return;
      if (cell !== current.cell || current.selecting) {
        event.preventDefault();
        current.selecting = true;
        root.classList.add("is-selecting-cells");
        window.getSelection()?.removeAllRanges();
        for (const previous of pickedCells.current) previous.removeAttribute("data-document-selected");
        const cells = documentTableCells(cell.closest("table")!, [current.cell, cell]);
        pickedCells.current = cells;
        for (const selected of cells) selected.setAttribute("data-document-selected", "true");
        setCellSelection({ count: cells.length, canSplit: cells.length === 1 && (cells[0].rowSpan > 1 || cells[0].colSpan > 1) });
        const colors = cells.map(cell => normalizeDocumentColor(cell.style.backgroundColor) ?? "");
        setCellColor(colors.every(value => value === colors[0]) ? colors[0] : "");
      }
    };
    const stop = () => { drag.current = null; box.current?.classList.remove("is-selecting-cells"); };
    document.addEventListener("mousemove", move, { passive: false });
    document.addEventListener("mouseup", stop);
    window.addEventListener("blur", stop);
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", stop); window.removeEventListener("blur", stop); };
  }, []);

  /** Format a rectangular cell selection and commit it as one table replacement for Undo. */
  function formatCells(command: string, value?: string) {
    const root = box.current;
    const table = selectedTable.current;
    const cells = pickedCells.current.filter(cell => root?.contains(cell));
    if (!root || !table || cells.length < (command === "cellColor" ? 1 : 2)) return false;
    const original = documentTableGrid(table);
    const coordinates = original.positions.filter(p => cells.includes(p.cell)).map(p => ({ row: p.row, column: p.column }));
    const staging = document.createElement("div");
    staging.contentEditable = "true";
    staging.className = "document-editor-box";
    staging.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0;font-size:12px;pointer-events:none";
    const clone = table.cloneNode(true) as HTMLTableElement;
    for (const cell of clone.querySelectorAll("[data-document-selected]")) cell.removeAttribute("data-document-selected");
    staging.append(clone);
    // The expanded editor is in a modal; formatting must stay inside its active focus boundary.
    (root.closest("dialog") ?? document.body).append(staging);
    const selection = window.getSelection();
    const select = (cell: HTMLTableCellElement) => {
      staging.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(cell);
      selection?.removeAllRanges();
      selection?.addRange(range);
    };
    try {
      const grid = documentTableGrid(clone).grid;
      const targets = coordinates.map(p => grid[p.row][p.column]);
      const toggle = ["bold", "italic", "underline"].includes(command);
      const enabled = toggle ? !targets.every(cell => { select(cell); return document.queryCommandState(command); }) : false;
      for (const cell of targets) {
        select(cell);
        if (command === "clearContents") {
          cell.innerHTML = "<br>";
        } else if (command === "cellColor") {
          cell.style.backgroundColor = value ?? "";
        } else if (command === "fontSize") {
          cell.style.fontSize = `${value}px`;
          for (const element of cell.querySelectorAll<HTMLElement>("*")) { element.style.fontSize = ""; if (element.tagName === "FONT") element.removeAttribute("size"); }
        } else if (command === "foreColor") {
          cell.style.color = value!;
          for (const element of cell.querySelectorAll<HTMLElement>("*")) { element.style.color = ""; if (element.tagName === "FONT") element.removeAttribute("color"); }
        } else if (toggle && !cell.textContent) {
          cell.innerHTML = enabled ? `<${command === "bold" ? "b" : command === "italic" ? "i" : "u"}><br></${command === "bold" ? "b" : command === "italic" ? "i" : "u"}>` : "<br>";
        } else if (!toggle || document.queryCommandState(command) !== enabled) document.execCommand(command, false, value);
      }
      replaceTable(table, clone, coordinates[0].row, coordinates[0].column, coordinates);
      if (toggle) setActive(previous => ({ ...previous, [command]: enabled }));
      if (command.startsWith("justify")) setActive(previous => ({ ...previous, justifyLeft: command === "justifyLeft", justifyCenter: command === "justifyCenter", justifyRight: command === "justifyRight", justifyFull: command === "justifyFull" }));
    } finally { staging.remove(); root.focus({ preventScroll: true }); }
    return true;
  }

  function replaceTable(existing: HTMLTableElement, replacement: HTMLTableElement, row = 0, column = 0, keepSelection?: { row: number; column: number }[]) {
    const root = box.current;
    if (!root) return;
    const index = [...root.querySelectorAll("table")].indexOf(existing);
    restore();
    const range = document.createRange();
    range.selectNode(existing);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand("insertHTML", false, replacement.outerHTML);
    const table = root.querySelectorAll("table")[index];
    if (table) {
      selectedTable.current = table;
      const cell = documentTableGrid(table).grid[row]?.[column];
      if (cell) {
        range.selectNodeContents(cell);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
        saved.current = range.cloneRange();
        cellAnchor.current = cell;
        selectCells(keepSelection ? keepSelection.map(p => documentTableGrid(table).grid[p.row][p.column]) : [cell]);
      }
    }
    changed();
  }

  function mergeCells(split = false) {
    const table = selectedTable.current;
    if (!table || !box.current?.contains(table)) return;
    try {
      const result = split ? splitDocumentTableCell(table, pickedCells.current[0]) : mergeDocumentTableCells(table, pickedCells.current);
      replaceTable(table, result.table, result.row, result.column);
      setTableError("");
    } catch (error) { setTableError(error instanceof Error ? error.message : "Select table cells first."); }
  }

  function openTable() {
    setRibbonPanel(null);
    setLinking(null);
    if (tableSettings) { setTableSettings(null); restore(); return; }
    const node = saved.current?.startContainer;
    const element = node instanceof HTMLElement ? node : node?.parentElement;
    const table = element?.closest("table") ?? pickedCells.current[0]?.closest("table") ?? null;
    selectedTable.current = table && box.current?.contains(table) ? table : null;
    const existing = selectedTable.current;
    if (existing && saved.current && !saved.current.collapsed) {
      const cells = [...existing.querySelectorAll<HTMLTableCellElement>("td, th")].filter(cell => saved.current!.intersectsNode(cell));
      selectCells(documentTableCells(existing, cells));
    }
    const grid = existing && documentTableGrid(existing);
    if (existing) setTableContext(true);
    setTableSettings({ rows: String(grid?.rows ?? 3), columns: String(grid?.columns ?? 2), header: existing ? Boolean(existing.rows[0]?.querySelector("th")) : true, editing: Boolean(existing) });
    setTableError("");
  }

  function applyTable(remove = false) {
    const root = box.current;
    if (!root || (!tableSettings && !remove)) return;
    const rows = Number(tableSettings?.rows);
    const columns = Number(tableSettings?.columns);
    if (!remove && (!Number.isInteger(rows) || rows < 1 || rows > 20 || !Number.isInteger(columns) || columns < 1 || columns > 10)) {
      setTableError("Choose 1–20 rows and 1–10 columns.");
      return;
    }
    restore();
    const existing = selectedTable.current;
    const selection = window.getSelection();
    if (existing && root.contains(existing)) {
      const range = document.createRange();
      range.selectNode(existing);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else if (selection?.rangeCount) {
      // A table is its own block, even when the cursor is currently inside bullet points.
      const node = selection.anchorNode;
      const list = (node instanceof HTMLElement ? node : node?.parentElement)?.closest("ul, ol");
      if (list && root.contains(list)) {
        const range = document.createRange();
        range.setStartAfter(list);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    if (remove) document.execCommand("delete");
    else {
      const table = resizeDocumentTable(existing, rows, columns, tableSettings!.header);
      document.execCommand("insertHTML", false, table.outerHTML + (existing ? "" : "<p><br></p>"));
    }
    setTableSettings(null);
    selectedTable.current = null;
    setTableContext(false);
    selectCells([]);
    changed();
  }

  function paste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const plain = event.clipboardData.getData("text/plain");
    let safeHtml: string;
    if (html) {
      const pasted = new DOMParser().parseFromString(html, "text/html");
      safeHtml = documentBodyHtml(readDocumentEditor(pasted.body));
    } else safeHtml = documentBodyHtml(parseDocumentBody(plain));
    document.execCommand("insertHTML", false, safeHtml);
    changed();
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    if (event.key === "Backspace" && !event.nativeEvent.isComposing && pickedCells.current.filter(cell => box.current?.contains(cell)).length > 1) {
      event.preventDefault();
      formatCells("clearContents");
      return;
    }
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      if (event.key.toLowerCase() === "k") { event.preventDefault(); openLink(); return; }
      const command = ({ b: "bold", i: "italic", u: "underline" } as const)[event.key.toLowerCase() as "b" | "i" | "u"];
      if (command) { event.preventDefault(); format(command); }
    }
    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      const cell = (node instanceof HTMLElement ? node : node?.parentElement)?.closest("td, th");
      if (cell && box.current?.contains(cell)) {
        const cells = [...cell.closest("table")!.querySelectorAll("td, th")];
        const next = cells[cells.indexOf(cell) + (event.shiftKey ? -1 : 1)];
        if (next) {
          event.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(next);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
        return;
      }
      if (event.shiftKey) {
        if (!selection?.rangeCount || !selection.isCollapsed) return;
        const original = selection.getRangeAt(0).cloneRange();
        selection.modify("extend", "backward", "character");
        if (selection.toString() === "\t") {
          event.preventDefault();
          document.execCommand("delete");
          changed();
        } else {
          // Without an indent to remove, Shift+Tab can leave the editor normally.
          selection.removeAllRanges();
          selection.addRange(original);
        }
      } else {
        event.preventDefault();
        document.execCommand("insertText", false, "\t");
        changed();
      }
    }
  }

  return (
    <div className={`document-editor email-editor${invalid ? " is-invalid" : ""}`}>
      {!readOnly && <div ref={ribbon} className="email-editor-tools document-ribbon" role="toolbar" aria-label="Main text formatting" onKeyDown={event => {
        if (event.key === "Escape" && ribbonPanel) { event.preventDefault(); event.stopPropagation(); setRibbonPanel(null); restore(); }
      }}>
        <div className="document-ribbon-group document-font-size" role="group" aria-label="Font size">
          <RibbonButton label="Decrease font size" disabled={fontSize <= 8} onClick={() => changeFontSize(Math.max(8, fontSize - 1))}><Minus size={ribbonIconSize} aria-hidden="true" /></RibbonButton>
          <select aria-label="Font size" title="Font size" value={fontSize} onChange={event => changeFontSize(Number(event.target.value))}>{[...new Set([...fontSizes, fontSize])].sort((a, b) => a - b).map(size => <option key={size} value={size}>{size}</option>)}</select>
          <RibbonButton label="Increase font size" disabled={fontSize >= 96} onClick={() => changeFontSize(Math.min(96, fontSize + 1))}><Plus size={ribbonIconSize} aria-hidden="true" /></RibbonButton>
        </div>
        <div className="document-ribbon-group" role="group" aria-label="Text appearance">
          {tools.slice(0, 3).map(({ command, label, icon: Icon }) => <RibbonButton key={command} label={label} aria-pressed={Boolean(active[command])} onClick={() => format(command)}><Icon size={ribbonIconSize} aria-hidden="true" /></RibbonButton>)}
          <div className="document-ribbon-popover">
            <RibbonButton label="Font color" aria-expanded={ribbonPanel === "color"} aria-haspopup="dialog" onClick={() => setRibbonPanel(ribbonPanel === "color" ? null : "color")}><span className="document-color-icon" aria-hidden="true" style={{ borderBottomColor: color }}>A</span></RibbonButton>
            {ribbonPanel === "color" && <ColorPalette label="Font color" color={color} onSelect={value => { changeColor(value); setRibbonPanel(null); }} />}
          </div>
        </div>
        <div className="document-ribbon-group" role="group" aria-label="Insert">
          <RibbonButton label="Hyperlink" aria-expanded={Boolean(linking)} onClick={openLink}><Link2 size={ribbonIconSize} aria-hidden="true" /></RibbonButton>
          <RibbonButton label="Insert horizontal line" onClick={insertHorizontalLine}><Minus size={ribbonIconSize} aria-hidden="true" /></RibbonButton>
        </div>
        <div className="document-ribbon-group" role="group" aria-label="Paragraph formatting">
          <div className="document-ribbon-popover">
            <RibbonButton label="Text alignment" className="document-alignment-trigger" aria-haspopup="true" aria-expanded={ribbonPanel === "alignment"} onClick={() => setRibbonPanel(ribbonPanel === "alignment" ? null : "alignment")}>
              {(() => { const Icon = layoutTools.slice(0, 4).find(tool => active[tool.command])?.icon ?? AlignLeft; return <Icon size={ribbonIconSize} aria-hidden="true" />; })()}<ChevronDown size={ribbonIconSize} aria-hidden="true" />
            </RibbonButton>
            {ribbonPanel === "alignment" && <div className="document-alignment-menu" role="group" aria-label="Text alignment">
              {layoutTools.slice(0, 4).map(({ command, label, icon: Icon }) => <RibbonButton key={command} label={label} aria-pressed={Boolean(active[command])} onClick={() => { format(command); setRibbonPanel(null); }}><Icon size={ribbonIconSize} aria-hidden="true" /></RibbonButton>)}
            </div>}
          </div>
          {tools.slice(3).map(({ command, label, icon: Icon }) => <RibbonButton key={command} label={label} aria-pressed={Boolean(active[command])} onClick={() => format(command)}><Icon size={ribbonIconSize} aria-hidden="true" /></RibbonButton>)}
          {layoutTools.slice(4).map(({ command, label, icon: Icon }) => <RibbonButton key={command} label={label} onClick={() => format(command)}><Icon size={ribbonIconSize} aria-hidden="true" /></RibbonButton>)}
        </div>
        <div className="document-ribbon-group document-table-actions" role="group" aria-label="Table actions">
          <RibbonButton label="Table settings" aria-expanded={Boolean(tableSettings)} onClick={openTable}><Table2 size={ribbonIconSize} aria-hidden="true" /></RibbonButton>
          <div className="document-ribbon-popover document-cell-color-popover">
            <RibbonButton label="Table cell color" disabled={!tableContext || !cellSelection.count} aria-expanded={ribbonPanel === "cellColor"} aria-haspopup="dialog" onClick={() => setRibbonPanel(ribbonPanel === "cellColor" ? null : "cellColor")}><PaintBucket size={ribbonIconSize} aria-hidden="true" /></RibbonButton>
            {ribbonPanel === "cellColor" && <ColorPalette label="Table cell color" color={cellColor} clearable onSelect={value => { formatCells("cellColor", value); setRibbonPanel(null); }} />}
          </div>
          <RibbonButton label="Merge cells" aria-label={cellSelection.count > 1 ? `Merge cells (${cellSelection.count})` : "Merge cells"} disabled={!tableContext || cellSelection.count < 2} onClick={() => mergeCells()}><TableCellsMerge size={ribbonIconSize} aria-hidden="true" /></RibbonButton>
          <RibbonButton label="Split cell" disabled={!tableContext || !cellSelection.canSplit} onClick={() => mergeCells(true)}><TableCellsSplit size={ribbonIconSize} aria-hidden="true" /></RibbonButton>
          <RibbonButton label="Remove table" disabled={!tableContext} onClick={() => applyTable(true)}><Trash2 size={ribbonIconSize} aria-hidden="true" /></RibbonButton>
        </div>
      </div>}
      {linking && <div className="email-editor-link">
        <input ref={linkInput} type="text" className="portal-input" aria-label="Link address" placeholder="https://… or an email address" aria-invalid={linking.error} value={linking.href} onChange={event => setLinking({ ...linking, href: event.target.value, error: false })} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setLinking(null); restore(); } }} />
        <button type="button" className="portal-button is-small" onClick={applyLink}>Apply link</button>
        {linking.existing && <button type="button" className="portal-button is-ghost is-small" onClick={removeLink}><Unlink size={13} aria-hidden="true" /> Remove link</button>}
        <button type="button" className="portal-button is-ghost is-small" onClick={() => { setLinking(null); restore(); }}>Cancel</button>
        {linking.error && <span className="portal-field-error" role="alert">Enter a valid web, email, or telephone link.</span>}
      </div>}
      {tableSettings && <div className="document-table-settings" role="group" aria-label="Table settings">
        <label>Rows<input type="number" min={1} max={20} value={tableSettings.rows} onChange={event => setTableSettings({ ...tableSettings, rows: event.target.value })} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyTable(); } }} /></label>
        <label>Columns<input type="number" min={1} max={10} value={tableSettings.columns} onChange={event => setTableSettings({ ...tableSettings, columns: event.target.value })} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); applyTable(); } }} /></label>
        <label className="document-table-header"><input type="checkbox" checked={tableSettings.header} onChange={event => setTableSettings({ ...tableSettings, header: event.target.checked })} /> Header row</label>
        <button type="button" className="portal-button is-small" onClick={() => applyTable()}>{tableSettings.editing ? "Update table" : "Insert table"}</button>
        <button type="button" className="portal-button is-ghost is-small" onClick={() => { setTableSettings(null); restore(); }}>Cancel</button>
        {tableError && <span className="portal-field-error" role="alert">{tableError}</span>}
      </div>}
      <div ref={box} className="email-editor-box document-editor-box" contentEditable={!readOnly} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-labelledby={labelledBy} aria-invalid={invalid || undefined} aria-readonly={readOnly} onInput={changed} onPaste={paste} onKeyDown={keyDown} onMouseDown={cellMouseDown} onDragStart={event => event.preventDefault()} dangerouslySetInnerHTML={initialMarkup} />
      {!readOnly && !tableSettings && tableError && <div className="document-table-error portal-field-error" role="alert">{tableError}</div>}
    </div>
  );
}
