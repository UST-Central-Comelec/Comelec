"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { motion, MotionConfig } from "motion/react";
import { Search, X } from "lucide-react";
import { newsCategories, newsroomCategories, newsroomLabels, type NewsroomCategory } from "@/lib/data/types";
import { categoryIcons, PostRow } from "./post-row";
import { byMonth, plural, type Story } from "./story";

/** The News page's address for a category and search, e.g. "/news?category=announcement&q=ballot". */
function hrefFor(category: NewsroomCategory | null, query: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (query.trim()) params.set("q", query.trim());
  const search = params.toString();
  return search ? `/news?${search}` : "/news";
}

const termsOf = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

/** A story matches when every search term is somewhere in its headline, summary or category. */
const matches = (story: Story, terms: string[]) => {
  const haystack = `${story.title} ${story.excerpt} ${newsCategories[story.category]}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
};

type Props = {
  /** Every post on the News page, newest first. */
  stories: Story[];
  initialCategory: NewsroomCategory | null;
  initialQuery: string;
};

/**
 * The News page's list: a bar of tabs (all, press releases, announcements, publications) and a search
 * box that stays under the navbar as you scroll, over the posts by month, newest first. The post the
 * commission featured is set apart at the top. Switching tab or searching happens in place and is
 * kept in the address, so a filtered view can be shared; without JavaScript the same links and
 * search form reach the same views from the server.
 */
export function NewsDesk({ stories, initialCategory, initialQuery }: Props) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const deskRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const terms = termsOf(query);
  const inCategory = category ? stories.filter((story) => story.category === category) : stories;
  const results = terms.length ? inCategory.filter((story) => matches(story, terms)) : null;
  const label = category ? newsroomLabels[category] : null;

  // Keep the address in step (without reloading), a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      const next = new URL(hrefFor(category, query), url.origin);
      if (url.search === next.search) return;
      window.history.replaceState(null, "", `${next.pathname}${next.search}${url.hash}`);
    }, 250);
    return () => clearTimeout(timer);
  }, [category, query]);

  // "/" jumps to the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (event: MouseEvent<HTMLAnchorElement>, next: NewsroomCategory | null) => {
    // New-tab and other modified clicks go to the link as usual.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setCategory(next);
    // Scrolled down the list? Come back up to the top of the new one.
    const desk = deskRef.current;
    if (desk && desk.getBoundingClientRect().top < 0) desk.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };

  const status = results
    ? `${plural(results.length, "result")} for “${query.trim()}”${label ? ` in ${label}` : ""}`
    : `${plural(inCategory.length, "post")}${label ? ` in ${label}` : ""}`;

  let feed: ReactNode;
  if (results?.length) {
    feed = (
      <section aria-label="Search results">
        <ListHead title="Search results" note={`${plural(results.length, "result")}${label ? ` in ${label}` : ""}`} />
        <ol className="nr-list">
          {results.map((story) => <li key={story.id}><PostRow story={story} terms={terms} /></li>)}
        </ol>
      </section>
    );
  } else if (results) {
    feed = (
      <Empty title="No matches." copy={`Nothing here matches “${query.trim()}”${label ? ` in ${label}` : ""}.`}>
        <button type="button" className="bp-button is-primary is-small" onClick={clearSearch}>Clear the search</button>
        {category && <Link href={hrefFor(null, query)} className="bp-button is-ghost is-small" onClick={(event) => pick(event, null)} prefetch={false}>Search all news</Link>}
      </Empty>
    );
  } else if (inCategory.length) {
    const pinned = inCategory.find((story) => story.featured);
    const rest = inCategory.filter((story) => story !== pinned);
    feed = (
      <>
        {pinned && <PostRow story={pinned} pinned />}
        {byMonth(rest).map(([month, items]) => (
          <section className="nr-month" key={month} aria-label={month}>
            <ListHead title={month} note={plural(items.length, "post")} />
            <ol className="nr-list">
              {items.map((story) => <li key={story.id}><PostRow story={story} grouped /></li>)}
            </ol>
          </section>
        ))}
      </>
    );
  } else {
    feed = (
      <Empty title="Nothing here yet." copy={label ? `No ${label.toLowerCase()} have been posted yet. Check back soon.` : "Nothing has been posted yet. Check back soon."}>
        {category && <Link href="/news" className="bp-button is-primary is-small" onClick={(event) => pick(event, null)} prefetch={false}>Show all news</Link>}
      </Empty>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div ref={deskRef} className="nr-desk">
        <div className="nr-tuner">
          <nav className="nr-channels" aria-label="Filter by category">
            <Channel href={hrefFor(null, query)} active={!category} count={stories.length} onClick={(event) => pick(event, null)}>All</Channel>
            {newsroomCategories.map((value) => {
              const Icon = categoryIcons[value];
              return (
                <Channel key={value} href={hrefFor(value, query)} active={category === value} count={stories.filter((story) => story.category === value).length} onClick={(event) => pick(event, value)}>
                  <Icon size={14} aria-hidden="true" />{newsroomLabels[value]}
                </Channel>
              );
            })}
          </nav>
          <form role="search" className="nr-search" action="/news" onSubmit={(event) => { event.preventDefault(); searchRef.current?.blur(); }}>
            {category && <input type="hidden" name="category" value={category} />}
            <label htmlFor="nr-search" title="Search (press /)">
              <Search size={16} aria-hidden="true" />
              <span className="visually-hidden">Search the news</span>
            </label>
            <input
              ref={searchRef}
              id="nr-search"
              type="search"
              name="q"
              value={query}
              placeholder="Search the news"
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                if (query) setQuery("");
                else event.currentTarget.blur();
              }}
            />
            {query ? <button type="button" className="nr-search-clear" onClick={clearSearch} aria-label="Clear the search"><X size={13} aria-hidden="true" /></button> : <kbd aria-hidden="true">/</kbd>}
          </form>
        </div>
        <p className="visually-hidden" role="status">{status}</p>
        {/* Keyed so a new view plays in, rather than the old one's rows rearranging. */}
        <div className="nr-feed" key={`${category ?? "all"}:${results ? "search" : "list"}`}>{feed}</div>
      </div>
    </MotionConfig>
  );
}

/** A tab in the bar, with its count. The current one sits on a thumb that slides between them. */
function Channel({ href, active, count, onClick, children }: { href: string; active: boolean; count: number; onClick: (event: MouseEvent<HTMLAnchorElement>) => void; children: ReactNode }) {
  return (
    <Link href={href} className={`nr-channel${active ? " is-active" : ""}${count === 0 ? " is-empty" : ""}`} aria-current={active ? "true" : undefined} onClick={onClick} prefetch={false}>
      {active && <motion.span layoutId="nr-channel-thumb" className="nr-channel-thumb" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
      <span>{children}</span>
      <small>{String(count).padStart(2, "0")}<span className="visually-hidden"> {count === 1 ? "post" : "posts"}</span></small>
    </Link>
  );
}

function ListHead({ title, note }: { title: string; note: string }) {
  return (
    <header className="bp-head">
      <h2>{title}</h2>
      <i aria-hidden="true" />
      <p>{note}</p>
    </header>
  );
}

function Empty({ title, copy, children }: { title: string; copy: string; children?: ReactNode }) {
  return (
    <div className="bp-empty">
      <span className="bp-empty-scope" aria-hidden="true"><i /></span>
      <h2>{title}</h2>
      <p>{copy}</p>
      {children && <div className="bp-empty-actions">{children}</div>}
    </div>
  );
}
