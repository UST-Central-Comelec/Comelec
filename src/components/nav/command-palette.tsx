"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Newspaper, Search, TrendingUp, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { readings, readingText, searchLinks, searchPrompts, topSearches, type NavStatus } from "@/components/nav/nav-data";

type Option = { id: string; label: string; hint?: string; meta?: string; href: string; icon: LucideIcon; live?: boolean };
type Group = { label: string; options: Option[] };

/** What the search lists: before anything is typed, what's open and the top searches; after, the menu links that match and a way into the News page's own search. */
function groupsFor(query: string, status: NavStatus): Group[] {
  const term = query.trim();
  if (!term) {
    const open = readings.filter((reading) => status[reading.key].open);
    return [
      { label: "Open now", options: open.map((reading) => ({ id: `open-${reading.key}`, label: reading.label, hint: readingText(status[reading.key], reading.closed), href: reading.href, icon: TrendingUp, live: true })) },
      { label: "Top searches", options: topSearches.map((search, index) => ({ id: `top-${index}`, label: search.label, href: search.href, icon: Search })) },
    ].filter((group) => group.options.length > 0);
  }
  const links = searchLinks(term);
  return [
    { label: "Go to", options: links.map((link) => ({ id: `link-${link.href}-${link.label}`, label: link.label, hint: link.description, meta: link.section, href: link.href, icon: link.icon })) },
    { label: "News", options: [{ id: "newsroom", label: `Search the news for “${term}”`, href: `/news?q=${encodeURIComponent(term)}`, icon: Newspaper }] },
  ].filter((group) => group.options.length > 0);
}

/** `text` with the first word of the search picked out where it appears. */
function Marked({ text, query }: { text: string; query: string }) {
  const word = query.trim().split(/\s+/)[0]?.toLowerCase();
  const at = word ? text.toLowerCase().indexOf(word) : -1;
  if (!word || at < 0) return text;
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + word.length)}</mark>{text.slice(at + word.length)}</>;
}

/** The field and its results. Mounted fresh each time the search opens, so it always starts empty. */
function PaletteBody({ open, status, onClose }: { open: boolean; status: NavStatus; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const groups = groupsFor(query, status);
  const options = groups.flatMap((group) => group.options);
  const current = options[Math.min(active, options.length - 1)];
  const found = !query.trim() || groups.some((group) => group.label === "Go to");

  // While it's empty, the field types suggestions into its own placeholder: "Search Comelec", "Search election updates", …
  useEffect(() => {
    const input = inputRef.current;
    if (!input || !open || query || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // It opens on the first one already typed out, holds it a moment, then moves through the rest.
    let prompt = 0;
    let length = searchPrompts[0].length;
    let deleting = true;
    let pause = 14;
    const timer = window.setInterval(() => {
      const text = searchPrompts[prompt];
      if (pause > 0) {
        pause -= 1;
        return;
      }
      length += deleting ? -1 : 1;
      input.placeholder = `Search ${text.slice(0, length)}`;
      if (!deleting && length === text.length) {
        deleting = true;
        pause = 14;
      } else if (deleting && length === 0) {
        deleting = false;
        prompt = (prompt + 1) % searchPrompts.length;
        pause = 3;
      }
    }, 75);

    return () => {
      window.clearInterval(timer);
      input.placeholder = "Search Comelec";
    };
  }, [open, query]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!options.length) return;
      const next = (options.indexOf(current) + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      setActive(next);
      // Keeps the option the arrow keys are on in view (the mouse never needs it).
      document.getElementById(`sh-option-${options[next].id}`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && current) {
      event.preventDefault();
      onClose();
      router.push(current.href);
    }
  };

  return (
    <div className="sh-palette-box">
      {/* A click anywhere on the field's row lands in the field. */}
      <div className="sh-palette-field" onClick={() => inputRef.current?.focus()}>
        <Search size={19} strokeWidth={1.7} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search Comelec"
          aria-expanded="true"
          aria-controls="sh-palette-list"
          aria-autocomplete="list"
          aria-activedescendant={current ? `sh-option-${current.id}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="Search Comelec"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className="sh-palette-close" aria-label="Close search" onClick={onClose}>
          <kbd aria-hidden="true">esc</kbd>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="sh-palette-list" id="sh-palette-list" role="listbox" aria-label="Results" data-lenis-prevent>
        {!found && <p className="sh-palette-empty">No page matches <b>“{query.trim()}”</b>. Try the news:</p>}
        {groups.map((group) => (
          <div role="group" aria-label={group.label} key={group.label}>
            <p className="sh-label" aria-hidden="true">{group.label}</p>
            {group.options.map((option) => (
              <Link
                key={option.id}
                id={`sh-option-${option.id}`}
                href={option.href}
                role="option"
                aria-selected={option === current}
                tabIndex={-1}
                className="sh-option"
                onClick={onClose}
                onPointerMove={() => { if (option !== current) setActive(options.indexOf(option)); }}
              >
                <span className="sh-option-icon"><option.icon size={15} strokeWidth={1.7} aria-hidden="true" /></span>
                <span className="sh-option-text">
                  <strong><Marked text={option.label} query={option.id === "newsroom" ? "" : query} /></strong>
                  {option.hint && <small>{option.live && <i className="sh-dot is-open" aria-hidden="true" />}{option.hint}</small>}
                </span>
                {option.meta && <span className="sh-option-meta">{option.meta}</span>}
                <CornerDownLeft className="sh-option-enter" size={14} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ))}
      </div>
      <p className="sh-palette-foot" aria-hidden="true">
        <span><kbd>↑</kbd><kbd>↓</kbd>Navigate</span>
        <span><kbd>↵</kbd>Open</span>
        <span><kbd>esc</kbd>Close</span>
      </p>
    </div>
  );
}

/**
 * The navbar's search (⌘K): a dialog over the page that looks through everything in the menu as you
 * type, with the arrow keys and Enter to get there, and hands longer questions to the News page's
 * own search. Before anything is typed it lists what's open now and the top searches.
 * A native <dialog>, so the page behind is inert, focus stays inside, Escape closes it and focus
 * goes back to wherever it was.
 */
export function CommandPalette({ open, session, status, onClose }: { open: boolean; session: number; status: NavStatus; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector("input")?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // A click that lands on the dialog itself, rather than anything in it, landed on the backdrop.
    <dialog ref={dialogRef} className="sh sh-palette" aria-label="Search" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <PaletteBody key={session} open={open} status={status} onClose={onClose} />
    </dialog>
  );
}
