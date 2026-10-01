import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { NewsDesk } from "@/components/news/news-desk";
import { formatShort, toStories } from "@/components/news/story";
import { PageBanner } from "@/components/page-banner";
import { getNews } from "@/lib/data/queries";
import { isNewsroomCategory } from "@/lib/data/types";
import { manilaToday } from "@/lib/events/format";
import "../banner-page.css";
import "./news.css";

export const metadata: Metadata = {
  title: "News",
  description: "Press releases, announcements and publications from the UST Central Comelec.",
};

/** Filters the News page used to have, and the pages that took them over. */
const moved: Record<string, string> = { event: "/events", explainer: "/explainer", "election-watch": "/explainer" };

const two = (value: number) => String(value).padStart(2, "0");

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const { category: categoryParam, q } = await searchParams;
  if (typeof categoryParam === "string" && Object.hasOwn(moved, categoryParam)) permanentRedirect(moved[categoryParam]);
  const category = typeof categoryParam === "string" && isNewsroomCategory(categoryParam) ? categoryParam : null;
  const query = typeof q === "string" ? q.slice(0, 100) : "";
  // Press releases, announcements and publications, newest first.
  const stories = toStories(await getNews());
  const year = manilaToday().slice(0, 4);

  return (
    <main className="bp nr">
      <RevealOnScroll />
      <PageBanner
        seed={1934}
        eyebrow="From the commission"
        title={<>Latest <em>news.</em></>}
        lede="Press releases, announcements and publications from the UST Central Comelec, newest first."
        readings={[
          { label: "Posts", value: two(stories.length) },
          { label: `In ${year}`, value: two(stories.filter((story) => story.date.startsWith(year)).length) },
          { label: "Latest", value: stories.length ? formatShort(stories[0].date) : "None yet" },
        ]}
      />
      <div className="bp-wrap bp-body">
        <NewsDesk stories={stories} initialCategory={category} initialQuery={query} />
      </div>
    </main>
  );
}
