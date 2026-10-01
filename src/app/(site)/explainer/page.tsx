import type { Metadata } from "next";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { PostRow } from "@/components/news/post-row";
import { formatShort, plural, toStories } from "@/components/news/story";
import { PageBanner } from "@/components/page-banner";
import { getExplainers } from "@/lib/data/queries";
import "../banner-page.css";
import "../news/news.css";

export const metadata: Metadata = {
  title: "Election Explainer",
  description: "Plain-language guides to how the University of Santo Tomas’s student elections work, from the UST Central Comelec.",
};

const two = (value: number) => String(value).padStart(2, "0");

export default async function ExplainerPage() {
  // The guides, newest first. They're written in the portal's News tab, filed under Explainer.
  const guides = toStories(await getExplainers());

  return (
    <main className="bp nr">
      <RevealOnScroll />
      <PageBanner
        seed={1946}
        eyebrow="For every voter"
        title={<>Election <em>explainer.</em></>}
        lede="Plain-language guides to how the University’s student elections work, written by the commission."
        readings={[
          { label: "Guides", value: two(guides.length) },
          { label: "Latest", value: guides.length ? formatShort(guides[0].date) : "None yet" },
        ]}
      />
      <div className="bp-wrap bp-body">
        {guides.length > 0 ? (
          <section aria-labelledby="nr-guides-title">
            <header className="bp-head">
              <h2 id="nr-guides-title">All guides</h2>
              <i aria-hidden="true" />
              <p>{plural(guides.length, "guide")}</p>
            </header>
            <ol className="nr-list">
              {guides.map((story, index) => <li key={story.id}><PostRow story={story} number={index + 1} /></li>)}
            </ol>
          </section>
        ) : (
          <div className="bp-empty">
            <span className="bp-empty-scope" aria-hidden="true"><i /></span>
            <h2>No guides yet.</h2>
            <p>The commission’s explainers appear here as soon as they’re published.</p>
          </div>
        )}
      </div>
    </main>
  );
}
