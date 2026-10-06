import type { NewsPost } from "@/lib/data/types";
import { newsContentText } from "@/lib/data/news-content";

/** A post as the lists show it: what a row and the search need, and no more. */
export type Story = Pick<NewsPost, "id" | "title" | "category" | "date" | "excerpt" | "featured"> & {
  /** Minutes to read the whole post. */
  minutes: number;
};

export function toStories(posts: NewsPost[]): Story[] {
  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    category: post.category,
    date: post.date,
    excerpt: newsContentText(post.excerpt),
    featured: post.featured,
    minutes: readingMinutes(post.body || post.excerpt),
  }));
}

export function readingMinutes(text: string) {
  return Math.max(1, Math.round(newsContentText(text).split(/\s+/).filter(Boolean).length / 220));
}

/** Where a post lives on the website: explainers on the Election Explainer, everything else in News. */
export const postHref = (post: Pick<NewsPost, "id" | "category">) => `${post.category === "explainer" ? "/explainer" : "/news"}/${post.id}`;

// Post dates are calendar dates, so they're read and shown in UTC: the same day everywhere.
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const parts = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "2-digit", weekday: "short", year: "numeric" });
const monthYear = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });

/** "Sep 12, 2026" */
export const formatShort = (iso: string) => shortDate.format(utc(iso));

/** A row's date block: { day: "12", month: "Sep", weekday: "Sat", year: "2026" }. */
export function dateParts(iso: string) {
  const values = Object.fromEntries(parts.formatToParts(utc(iso)).map((part) => [part.type, part.value]));
  return { day: values.day, month: values.month, weekday: values.weekday, year: values.year };
}

/** Stories grouped by month, in the order given: [["September 2026", [...]], ...]. */
export function byMonth(stories: Story[]) {
  const months = new Map<string, Story[]>();
  for (const story of stories) {
    const month = monthYear.format(utc(story.date));
    months.set(month, [...(months.get(month) ?? []), story]);
  }
  return [...months];
}

/** "1 post", "3 posts" */
export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
