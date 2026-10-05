"use client";

import { unstable_rethrow } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useReducer, useRef, useState, useTransition, type Dispatch, type RefObject } from "react";
import { DndContext, KeyboardSensor, MeasuringStrategy, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, ListOrdered, Plus, Send, Trash2, Undo2 } from "lucide-react";
import { describeStats, diffArticles, totalChanges, type SectionChange } from "@/lib/codes/diff";
import { newKey, reduce, toEditable, fromEditable, type Edit, type EditArticle, type EditSection, type EditState } from "@/lib/codes/editing";
import { codes, type CodeKey } from "@/lib/codes/options";
import { articleName, newAnchor, nextNumber, nextNumeral, sectionName, tidyArticles } from "@/lib/codes/text";
import { blockText, type CodeArticle } from "@/lib/elections-code/usec-2011";
import type { CodeFormState } from "@/lib/portal/code-actions";
import { CodeChanges } from "./code-changes";
import { SectionBlocks, type Focus } from "./code-section-editor";
import { DeleteButton } from "./delete-button";
import { Dropdown } from "./dropdown";
import { TitleWithInfo } from "./info-tip";
import { useHydrated } from "./portal-form";

/** The draft as it was last saved: which revision it is, and how many times it has been saved. */
type Draft = { id: string; edits: number; at: string };

type Props = {
  code: CodeKey;
  /** The published text the revision is measured against. */
  base: CodeArticle[];
  /** The text to start from: the draft as it was last saved, or the published text when there's no draft yet. */
  initial: CodeArticle[];
  draft: Draft | null;
  /** The note to those who approve, as it was last saved. */
  note: string;
  save: (state: CodeFormState, formData: FormData) => Promise<CodeFormState>;
  discard: (id: string) => Promise<void>;
};

const savedAt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const changeLabels: Record<SectionChange["kind"], string> = { added: "New", removed: "Removed", edited: "Edited", moved: "Moved" };

type Mover = ReturnType<typeof useSortable>;

/**
 * The grip a row is dragged by. With the keyboard: Space picks the row up, the arrows move it, Space
 * drops it. `onGrab` runs as the row is taken hold of, before it moves.
 */
function Grip({ handle, attributes, listeners, label, onGrab }: { handle: Mover["setActivatorNodeRef"]; attributes: Mover["attributes"]; listeners: Mover["listeners"]; label: string; onGrab?: () => void }) {
  return (
    <button
      type="button"
      className="code-grip"
      ref={handle}
      {...attributes}
      {...listeners}
      onPointerDown={(event) => {
        onGrab?.();
        listeners?.onPointerDown?.(event);
      }}
      onKeyDown={(event) => {
        if (event.code === "Space" || event.code === "Enter") onGrab?.();
        listeners?.onKeyDown?.(event);
      }}
      aria-label={`Move ${label}`}
      title="Drag to reorder"
    >
      <GripVertical size={15} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

/** A list whose rows can be dragged into a new order, or moved with the keyboard. `onMove` gets the places a row left and landed. */
function Sortable({ ids, names, onMove, children }: { ids: string[]; names: (id: string) => string; onMove: (from: number, to: number) => void; children: React.ReactNode }) {
  const id = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const placeOf = (item: string | number | undefined) => ids.indexOf(String(item)) + 1;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onMove(placeOf(active.id) - 1, placeOf(over.id) - 1);
  };

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      // Measured as the drag goes: a section folds shut as it's picked up, so the rows aren't where they were.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: "To reorder, press Space to pick this up, use the arrow keys to move it, then press Space to drop it or Escape to cancel." },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${names(String(active.id))}, position ${placeOf(active.id)} of ${ids.length}.`,
          onDragOver: ({ active, over }) => (over ? `${names(String(active.id))} is now at position ${placeOf(over.id)} of ${ids.length}.` : undefined),
          onDragEnd: ({ active, over }) => (over ? `${names(String(active.id))} dropped at position ${placeOf(over.id)} of ${ids.length}.` : `${names(String(active.id))} dropped.`),
          onDragCancel: ({ active }) => `Reordering cancelled. ${names(String(active.id))} is back where it was.`,
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

/** One article in the list alongside: its grip, and a button that opens it. `changes` is how many of its sections the revision touches. */
function ArticleTab({ article, active, changes, onSelect }: { article: EditArticle; active: boolean; changes: number; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: article.id });
  return (
    <li ref={setNodeRef} className={isDragging ? "is-dragging" : undefined} style={{ transform: CSS.Translate.toString(transform), transition }}>
      <Grip handle={setActivatorNodeRef} attributes={attributes} listeners={listeners} label={articleName(article)} />
      <button type="button" className="code-edit-tab" aria-current={active ? "true" : undefined} onClick={onSelect}>
        <span>{article.numeral}</span>
        <b>{article.title || "Untitled"}</b>
        {changes > 0 && <small title={`${changes} ${changes === 1 ? "section" : "sections"} changed`}>{changes}</small>}
      </button>
    </li>
  );
}

type SectionProps = {
  section: EditSection;
  article: EditArticle;
  /** Every article, for moving the section to another. */
  places: Array<{ value: string; label: string }>;
  open: boolean;
  change: SectionChange["kind"] | undefined;
  dispatch: Dispatch<Edit>;
  focusRef: RefObject<Focus | null>;
  onToggle: (id: string) => void;
};

/** One section: a row to drag and to open, and, opened, its number and title, its words, and where to move or remove it. */
function SectionItem({ section, article, places, open, change, dispatch, focusRef, onToggle }: SectionProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const name = sectionName(section);
  const set = (fields: Partial<Pick<EditSection, "number" | "title" | "label">>) => dispatch({ type: "section-set", id: section.id, fields });
  const bodyId = `${section.id}-edit`;

  return (
    <div ref={setNodeRef} className={`code-edit-section${open ? " is-open" : ""}${isDragging ? " is-dragging" : ""}`} style={{ transform: CSS.Translate.toString(transform), transition }}>
      <div className="code-edit-section-head">
        {/* An open section is as tall as its text, which is no size to drag: it folds shut as it's picked up. */}
        <Grip handle={setActivatorNodeRef} attributes={attributes} listeners={listeners} label={name} onGrab={open ? () => onToggle(section.id) : undefined} />
        <button type="button" className="code-edit-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(section.id)}>
          <span className="code-number">{name}</span>
          {/* Sections with no title of their own: their opening words stand in */}
          {section.title ? <span className="code-title">{section.title}</span> : <span className="code-title is-preview">{section.blocks[0] ? blockText(section.blocks[0]) : "No text yet"}</span>}
          {change && <span className={`portal-tag code-change-tag is-${change}`}>{changeLabels[change]}</span>}
          <ChevronDown className="code-chevron" size={17} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="code-edit-body" id={bodyId}>
          <div className="code-edit-fields">
            <label className="portal-field is-number">
              <span className="portal-field-label">Number</span>
              <input value={section.number ?? ""} maxLength={16} placeholder="None" autoComplete="off" onChange={(event) => set({ number: event.target.value || null })} />
            </label>
            {/* A section with no number goes by a name instead: the Preamble. */}
            {!section.number && (
              <label className="portal-field is-number">
                <span className="portal-field-label">Name</span>
                <input value={section.label ?? ""} maxLength={80} placeholder="Preamble" autoComplete="off" onChange={(event) => set({ label: event.target.value || undefined })} />
              </label>
            )}
            <label className="portal-field is-title">
              <span className="portal-field-label">Title</span>
              <input value={section.title ?? ""} maxLength={240} placeholder="None" autoComplete="off" onChange={(event) => set({ title: event.target.value || null })} />
            </label>
          </div>
          <SectionBlocks section={section} dispatch={dispatch} focusRef={focusRef} />
          <div className="code-edit-foot">
            <span className="code-edit-move">
              <span className="portal-index">Under</span>
              <Dropdown size="pill" label="The article this section is under" options={places} value={article.id} onChange={(to) => to !== article.id && dispatch({ type: "section-send", id: section.id, to, undo: `${name} moved to ${places.find((place) => place.value === to)?.label ?? "another article"}` })} />
            </span>
            <DeleteButton action={async () => dispatch({ type: "section-remove", id: section.id, undo: `${name} removed` })} label="Remove section" prompt={`Remove ${name}?`} confirmLabel="Yes, remove" pendingLabel="Removing…" icon={<Trash2 size={14} aria-hidden="true" />} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Where a revision of the Constitution or the Elections Code is written. The articles are listed
 * alongside; the one picked shows its sections, each of which opens to its number, its title and
 * its words. Articles and sections are dragged into order, added and removed; a removal can be
 * undone until the next change. Nothing reaches the server until Save draft, and nothing reaches
 * the website until the revision is sent for approval and approved.
 */
export function CodeEditor({ code, base, initial, draft: savedDraft, note: savedNote, save, discard }: Props) {
  const { the } = codes[code];
  const [{ articles, undo }, dispatch] = useReducer(reduce, initial, (text): EditState => ({ articles: toEditable(text), undo: null }));
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = useState(savedNote);
  const [draft, setDraft] = useState(savedDraft);
  // What the server holds, to tell whether there's anything to save.
  const [saved, setSaved] = useState(() => ({ text: JSON.stringify(tidyArticles(initial)), note: savedNote }));
  const [result, setResult] = useState<CodeFormState>();
  const [reviewing, setReviewing] = useState(false);
  const [pending, startTransition] = useTransition();
  const focusRef = useRef<Focus | null>(null);
  const hydrated = useHydrated();

  // Counted a beat behind the typing, so a long text never slows a keystroke.
  const settled = useDeferredValue(articles);
  const text = useMemo(() => fromEditable(settled), [settled]);
  const serialized = useMemo(() => JSON.stringify(text), [text]);
  const diff = useMemo(() => diffArticles(base, text, reviewing), [base, text, reviewing]);
  const dirty = serialized !== saved.text || note.trim() !== saved.note.trim();
  const changes = totalChanges(diff.stats);

  const active = articles.find((article) => article.id === activeId) ?? articles[0] ?? null;
  const changed = new Map(diff.sections.map((change) => [change.section.id, change.kind]));
  const changesIn = (id: string) => diff.sections.filter((change) => change.article.id === id).length + (diff.articles.some((change) => change.article.id === id) ? 1 : 0);
  const places = articles.map((article) => ({ value: article.id, label: article.numeral ? `Article ${article.numeral} · ${article.title || "Untitled"}` : article.title || "Untitled" }));

  // Leaving with unsaved changes: the browser asks before a reload or a closed tab, and a link elsewhere asks too.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.origin !== window.location.origin || (link.pathname === window.location.pathname && link.hash)) return;
      if (window.confirm("You have changes that aren’t saved. Leave without saving them?")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", onLeave);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const send = (intent: "save" | "submit") => {
    const body = JSON.stringify(fromEditable(articles));
    const data = new FormData();
    data.set("articles", body);
    data.set("summary", note);
    data.set("revision", draft?.id ?? "");
    data.set("edits", String(draft?.edits ?? 0));
    data.set("intent", intent);
    startTransition(async () => {
      try {
        const next = await save(undefined, data);
        setResult(next);
        if (next?.saved) {
          setDraft(next.saved);
          setSaved({ text: body, note });
        }
      } catch (error) {
        // Sent for approval, the server answers by opening the revision's page.
        unstable_rethrow(error);
        setResult({ error: "Couldn’t reach the server, so nothing was saved. Your changes are still here: check your connection, then save again." });
      }
    });
  };

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const addArticle = () => {
    const id = newAnchor("article");
    dispatch({ type: "article-add", article: { id, number: articles.length + 1, numeral: nextNumeral(articles), title: "", sections: [] } });
    setActiveId(id);
  };

  const addSection = () => {
    if (!active) return;
    const id = newAnchor("section");
    const key = newKey();
    dispatch({ type: "section-add", article: active.id, section: { id, number: nextNumber(active.sections), title: null, blocks: [{ key, level: 0, runs: [] }] } });
    setOpen((current) => new Set(current).add(id));
    focusRef.current = { key, at: 0 };
  };

  const removeArticle = (article: EditArticle) => {
    const at = articles.findIndex((item) => item.id === article.id);
    dispatch({ type: "article-remove", id: article.id, undo: `${articleName(article)} removed` });
    setActiveId((articles[at + 1] ?? articles[at - 1])?.id ?? null);
  };

  const status = pending ? "Saving…" : dirty ? "Unsaved changes" : draft ? `Draft saved ${savedAt.format(new Date(draft.at))}` : "Nothing changed yet";

  return (
    <div className="code-editor">
      <div className="code-edit-layout">
        <aside className="code-edit-rail" aria-label="Articles">
          <p className="portal-index">Articles</p>
          <Sortable ids={articles.map((article) => article.id)} names={(id) => articleName(articles.find((article) => article.id === id) ?? { numeral: null, title: "article" })} onMove={(from, to) => dispatch({ type: "article-move", from, to })}>
            <ol>
              {articles.map((article) => <ArticleTab key={article.id} article={article} active={article.id === active?.id} changes={changesIn(article.id)} onSelect={() => setActiveId(article.id)} />)}
            </ol>
          </Sortable>
          <div className="code-edit-rail-tools">
            <button type="button" className="portal-button is-ghost is-small" onClick={addArticle}><Plus size={14} aria-hidden="true" /> Add article</button>
            <button type="button" className="portal-button is-ghost is-small" onClick={() => dispatch({ type: "articles-renumber", undo: "Articles renumbered" })} title="Number the articles I, II, III… in the order they’re in. One without a numeral, like the Preamble, is left as it is."><ListOrdered size={14} aria-hidden="true" /> Renumber</button>
          </div>
        </aside>

        <div className="code-edit-main">
          {!active ? (
            <section className="portal-card is-flush"><p className="portal-empty">There are no articles. <button type="button" className="code-edit-link" onClick={addArticle}>Add the first one.</button></p></section>
          ) : (
            // Keyed on the article, so its fields and open sections are its own.
            <div className="code-edit-pane" key={active.id}>
              <section className="portal-card code-edit-article" aria-label={articleName(active)}>
                <div className="code-edit-fields">
                  <label className="portal-field is-number">
                    <span className="portal-field-label">Article</span>
                    <input value={active.numeral ?? ""} maxLength={16} placeholder="None" autoComplete="off" title="Its numeral: IV. Leave it empty for a part that isn’t a numbered article, like the Preamble." onChange={(event) => dispatch({ type: "article-set", id: active.id, fields: { numeral: event.target.value || null } })} />
                  </label>
                  <label className="portal-field is-title">
                    <span className="portal-field-label">Title</span>
                    <input value={active.title} maxLength={240} placeholder="The article’s title" autoComplete="off" autoFocus={!active.title} onChange={(event) => dispatch({ type: "article-set", id: active.id, fields: { title: event.target.value } })} />
                  </label>
                </div>
                <div className="code-edit-article-tools">
                  <span className="portal-index">{active.sections.length} {active.sections.length === 1 ? "section" : "sections"}</span>
                  <button type="button" className="portal-button is-ghost is-small" disabled={active.sections.length === 0} onClick={() => dispatch({ type: "sections-renumber", article: active.id, undo: `${articleName(active)}’s sections renumbered` })} title="Number this article’s sections 1, 2, 3… in the order they’re in. A section that goes by a name is left as it is."><ListOrdered size={14} aria-hidden="true" /> Renumber sections</button>
                  <DeleteButton action={async () => removeArticle(active)} label="Remove article" prompt={active.sections.length ? `Remove this article and its ${active.sections.length} ${active.sections.length === 1 ? "section" : "sections"}?` : "Remove this article?"} confirmLabel="Yes, remove" pendingLabel="Removing…" icon={<Trash2 size={14} aria-hidden="true" />} />
                </div>
              </section>

              {active.sections.length === 0 ? (
                <section className="portal-card is-flush"><p className="portal-empty">This article has no sections yet.</p></section>
              ) : (
                <div className="portal-card is-flush code-edit-sections">
                  <Sortable ids={active.sections.map((section) => section.id)} names={(id) => sectionName(active.sections.find((section) => section.id === id) ?? { number: null, label: "section" })} onMove={(from, to) => dispatch({ type: "section-move", article: active.id, from, to })}>
                    {active.sections.map((section) => <SectionItem key={section.id} section={section} article={active} places={places} open={open.has(section.id)} change={changed.get(section.id)} dispatch={dispatch} focusRef={focusRef} onToggle={toggle} />)}
                  </Sortable>
                </div>
              )}
              <button type="button" className="portal-button is-ghost code-edit-add-section" onClick={addSection}><Plus size={15} aria-hidden="true" /> Add section</button>
            </div>
          )}
        </div>
      </div>

      <section className="portal-card code-send" aria-labelledby="code-send-title">
        <header className="portal-card-head">
          <TitleWithInfo as="h2" className="portal-card-title" id="code-send-title" info={`Sent for approval, the revision goes to the Chairperson, the Vice Chairperson and the Secretary to the Executive, and its text is locked until they decide. The website shows it only once all three have approved. Until then ${the} stays as published.`}>For those who approve</TitleWithInfo>
          <span className="portal-index">{describeStats(diff.stats)}</span>
        </header>
        <label className="portal-field">
          <span className="portal-field-label">What changed, and why</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={note}
            placeholder="e.g. Article VII, Section 5: the sizes allowed for posters, as amended by Resolution No. 2026-004."
            onChange={(event) => {
              setNote(event.target.value);
              // What was in the way of sending it may be this very note.
              setResult(undefined);
            }}
          />
        </label>
        <details className="code-send-review" onToggle={(event) => setReviewing(event.currentTarget.open)}>
          <summary><ChevronDown className="code-chevron" size={16} aria-hidden="true" /> See what this revision changes</summary>
          {reviewing && <CodeChanges diff={diff} />}
        </details>
      </section>

      <div className="code-edit-dock">
        {result?.error && (
          <div className="portal-form-error" role="alert">
            {result.error}
            {result.problems && <ul>{result.problems.slice(0, 8).map((problem) => <li key={problem}>{problem}</li>)}{result.problems.length > 8 && <li>And {result.problems.length - 8} more.</li>}</ul>}
          </div>
        )}
        <div className={`code-edit-bar${dirty ? " is-dirty" : ""}`}>
          <p className="code-edit-status" role="status">
            {undo ? <>{undo.label}. <button type="button" className="code-edit-link" onClick={() => dispatch({ type: "undo" })}><Undo2 size={13} aria-hidden="true" /> Undo</button></> : status}
          </p>
          <div className="portal-form-actions">
            {draft && <DeleteButton tone="quiet" action={() => discard(draft.id)} label="Discard draft" prompt={`Discard this draft? ${the[0].toUpperCase()}${the.slice(1)} stays as published.`} confirmLabel="Yes, discard" pendingLabel="Discarding…" />}
            <button type="button" className="portal-button is-ghost" disabled={pending || !hydrated || !dirty} onClick={() => send("save")}>{pending ? "Saving…" : dirty || !draft ? "Save draft" : "Saved"}</button>
            <button type="button" className="portal-button" disabled={pending || !hydrated || changes === 0} onClick={() => send("submit")}><Send size={15} aria-hidden="true" /> Send for approval</button>
          </div>
        </div>
      </div>
    </div>
  );
}
