import Link from "next/link";
import { ArrowUpRight, BookOpen, Lightbulb, Megaphone, Newspaper, type LucideIcon } from "lucide-react";
import { newsCategories, type NewsCategory } from "@/lib/data/types";
import { dateParts, formatShort, postHref, type Story } from "./story";

export const categoryIcons: Record<NewsCategory, LucideIcon> = {
  "press-release": Newspaper,
  announcement: Megaphone,
  publication: BookOpen,
  explainer: Lightbulb,
};

export function CategoryTag({ category }: { category: NewsCategory }) {
  const Icon = categoryIcons[category];
  return <span className="nr-tag"><Icon size={12} aria-hidden="true" />{newsCategories[category]}</span>;
}

/** `text` with the search terms marked. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return text;
  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  // Splitting on a captured pattern puts the matches at the odd places.
  return text.split(pattern).map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part));
}

type Props = {
  story: Story;
  /** Search terms to mark in the headline and summary. */
  terms?: string[];
  /** Under a month's heading, the date block says the weekday; on its own, the year. */
  grouped?: boolean;
  /** Set for a guide: its place in the list stands where the date would, and the date moves into the line above the title. */
  number?: number;
  /** The post the commission featured: set apart at the top of the list. */
  pinned?: boolean;
};

/**
 * A post as one row of a list: when, what kind, the headline and its summary. The headline's link
 * covers the whole row. Shared by the News page, the Election Explainer and the "more" lists under
 * a post, in src/app/(site)/news/news.css.
 */
export function PostRow({ story, terms = [], grouped = false, number, pinned = false }: Props) {
  const { day, month, weekday, year } = dateParts(story.date);
  return (
    <article className={`nr-row${pinned ? " is-pinned" : ""}`}>
      {number === undefined ? (
        <time className="nr-row-date" dateTime={story.date}><b>{day}</b><span>{grouped ? `${month} · ${weekday}` : `${month} ${year}`}</span></time>
      ) : (
        <p className="nr-row-date" aria-hidden="true"><b>{String(number).padStart(2, "0")}</b><span>Guide</span></p>
      )}
      <div className="nr-row-main">
        <p className="nr-meta">
          {pinned && <span className="nr-pin">Featured</span>}
          {/* In a list of guides every row is one, so the date takes the tag's place. */}
          {number === undefined ? <CategoryTag category={story.category} /> : <time dateTime={story.date}>{formatShort(story.date)}</time>}
          <span>{story.minutes} min read</span>
        </p>
        <h3 className="nr-row-title"><Link href={postHref(story)} className="nr-stretch"><Marked text={story.title} terms={terms} /></Link></h3>
        <p className="nr-row-excerpt"><Marked text={story.excerpt} terms={terms} /></p>
      </div>
      <ArrowUpRight className="nr-row-arrow" size={20} aria-hidden="true" />
    </article>
  );
}
