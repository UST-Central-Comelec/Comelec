"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Download, Search, X } from "lucide-react";

/** Each section's words, in lower case, read once. */
const words = new WeakMap<HTMLDetailsElement, string>();

const allSections = () => [...document.querySelectorAll<HTMLDetailsElement>("#ec-code details")];

/**
 * Leaves only the sections with `term` in them, opened, and says how many there are. With no term
 * every section comes back, closed.
 */
function showMatches(term: string) {
  const articles = new Map<HTMLElement, boolean>();
  let count = 0;
  for (const section of allSections()) {
    let text = words.get(section);
    if (text === undefined) words.set(section, (text = (section.textContent ?? "").toLowerCase()));
    const match = !term || text.includes(term);
    section.hidden = !match;
    section.open = Boolean(term) && match;
    if (match) count += 1;
    const article = section.closest<HTMLElement>(".ec-article");
    if (article) articles.set(article, Boolean(articles.get(article)) || match);
  }
  for (const [article, shown] of articles) article.hidden = !shown;
  const none = document.getElementById("ec-none");
  if (none) none.hidden = count > 0;
  return count;
}

/** Opens or closes every section that's showing. */
function setAll(open: boolean) {
  for (const section of allSections()) if (!section.hidden) section.open = open;
}

/** A section on its way open or closed, so a second click can turn it around mid-way. */
const moving = new WeakMap<HTMLDetailsElement, Animation>();

const EASE = "cubic-bezier(.22, 1, .36, 1)";

/**
 * Opens or closes one section with its height easing between the two, the text fading with it.
 * <details> on its own snaps; this runs only for a section the reader clicks, so opening all of
 * them, a search, or a link to a section still land at once.
 */
function slide(section: HTMLDetailsElement, summary: HTMLElement) {
  const text = section.querySelector<HTMLElement>(".ec-text");
  const opening = !section.open || section.hasAttribute("data-closing");
  // Where it stands now: mid-way, if it was already moving.
  const from = section.offsetHeight;
  moving.get(section)?.cancel();
  section.toggleAttribute("data-closing", !opening);
  if (opening) section.open = true;
  const closed = summary.offsetHeight + section.offsetHeight - section.clientHeight;
  const to = opening ? section.offsetHeight : closed;
  // Longer sections take a little longer, within limits, so short ones don't crawl and long ones don't snap.
  const duration = Math.min(720, Math.max(340, 280 + Math.abs(to - from) * 0.35));
  section.style.overflow = "clip";
  const animation = section.animate({ height: [`${from}px`, `${to}px`] }, { duration, easing: EASE });
  text?.animate(opening ? { opacity: [0, 1], transform: ["translateY(-8px)", "none"] } : { opacity: [1, 0], transform: ["none", "translateY(-8px)"] }, { duration: opening ? duration : duration * 0.6, easing: opening ? EASE : "ease-out", fill: "both" });
  moving.set(section, animation);
  animation.onfinish = () => {
    if (!opening) section.open = false;
    section.removeAttribute("data-closing");
    section.style.overflow = "";
    text?.getAnimations().forEach((running) => running.cancel());
    moving.delete(section);
  };
}

/** What's searched for: the query in lower case, once it's past one letter (which nearly every section has). */
const termOf = (query: string) => {
  const term = query.trim().toLowerCase();
  return term.length > 1 ? term : "";
};

/**
 * The toolbar over a document read on the page (the Elections Code, the Constitution): a search across
 * it, open-all and close-all, and the PDF.
 * The sections themselves are plain <details> rendered on the server (they open without JavaScript);
 * this works on them where they stand, so the Code's text isn't sent to the browser twice.
 */
export function CodeTools({ pdf, total, name }: { pdf: string; total: number; name: string }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState(total);
  const searchRef = useRef<HTMLInputElement>(null);
  const searching = termOf(query) !== "";

  const search = (value: string) => {
    setQuery(value);
    if (termOf(value) !== termOf(query)) setFound(showMatches(termOf(value)));
  };

  // A link to a section (#article-2-section-3) opens it, on arrival and when followed within the page.
  useEffect(() => {
    const reveal = (jump: boolean) => {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!(target instanceof HTMLDetailsElement)) return;
      target.open = true;
      if (jump) target.scrollIntoView({ block: "start" });
    };
    const handleHash = () => reveal(false);
    reveal(true);
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // A click on a section's heading slides it open or closed, unless the reader asks for less motion.
  useEffect(() => {
    const code = document.getElementById("ec-code");
    if (!code || typeof Element.prototype.animate !== "function") return;
    const handleClick = (event: MouseEvent) => {
      const summary = (event.target as HTMLElement).closest<HTMLElement>("summary");
      const section = summary?.parentElement;
      if (!summary || !(section instanceof HTMLDetailsElement)) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      event.preventDefault();
      slide(section, summary);
    };
    code.addEventListener("click", handleClick);
    return () => code.removeEventListener("click", handleClick);
  }, []);

  // "/" jumps to the search, as on the News page.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const status = searching ? `${found} of ${total} sections ${found === 1 ? "has" : "have"} “${query.trim()}”` : `${total} sections`;

  return (
    <div className="ec-tools">
      <form role="search" className="nr-search" onSubmit={(event) => { event.preventDefault(); searchRef.current?.blur(); }}>
        <label htmlFor="ec-search" title="Search (press /)">
          <Search size={16} aria-hidden="true" />
          <span className="visually-hidden">Search the {name}</span>
        </label>
        <input
          ref={searchRef}
          id="ec-search"
          type="search"
          value={query}
          placeholder={`Search the ${name}`}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          onChange={(event) => search(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            if (query) search("");
            else event.currentTarget.blur();
          }}
        />
        {query ? <button type="button" className="nr-search-clear" onClick={() => { search(""); searchRef.current?.focus(); }} aria-label="Clear the search"><X size={13} aria-hidden="true" /></button> : <kbd aria-hidden="true">/</kbd>}
      </form>
      <p className="ec-status" role="status">{status}</p>
      <div className="ec-actions">
        <button type="button" className="bp-button is-ghost is-small" onClick={() => setAll(true)}><ChevronsUpDown size={15} aria-hidden="true" />Open all</button>
        <button type="button" className="bp-button is-ghost is-small" onClick={() => setAll(false)}><ChevronsDownUp size={15} aria-hidden="true" />Close all</button>
        <a className="bp-button is-primary is-small" href={pdf} download><Download size={15} aria-hidden="true" />Download PDF</a>
      </div>
    </div>
  );
}
