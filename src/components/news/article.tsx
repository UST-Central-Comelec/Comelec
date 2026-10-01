import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { NightSky } from "@/components/night-sky";
import { formatDate, type NewsPost } from "@/lib/data/types";
import { CopyLink } from "./copy-link";
import { CategoryTag, PostRow } from "./post-row";
import { readingMinutes, type Story } from "./story";

/** The page a post belongs to: News, or the Election Explainer. */
export type ArticleSection = {
  /** The breadcrumb back to the list, and where it leads. */
  label: string;
  href: string;
  /** A second breadcrumb, for the post's category within News. */
  crumb?: { label: string; href: string };
  /** The heading over the posts listed under this one, and the link at its end. */
  moreTitle: string;
  allLabel: string;
};

const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

/**
 * A post's own page, for News and the Election Explainer alike: its headline and summary in the
 * banner, the text in a reading column beside a card of its facts, then a few more posts from the
 * same page. Styled by src/app/(site)/banner-page.css and src/app/(site)/news/news.css.
 */
export function Article({ post, section, more }: { post: NewsPost; section: ArticleSection; more: Story[] }) {
  // A post saved with only its summary repeats it as the body; that isn't shown twice.
  const paragraphs = post.body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph && paragraph !== post.excerpt);

  return (
    <main className="bp nr">
      <RevealOnScroll />

      <article aria-labelledby="nr-story-title">
        <header className="bp-banner" data-hero>
          <NightSky seed={1934} count={56} />
          <div className="bp-wrap">
            <nav className="bp-crumbs" aria-label="Breadcrumb" data-enter style={enter(0)}>
              <Link href={section.href}><ArrowLeft size={14} aria-hidden="true" />{section.label}</Link>
              {section.crumb && (
                <>
                  <span aria-hidden="true">/</span>
                  <Link href={section.crumb.href}>{section.crumb.label}</Link>
                </>
              )}
            </nav>
            <h1 id="nr-story-title" className="bp-title is-headline" data-enter style={enter(1)}>{post.title}</h1>
            <p className="bp-lede" data-enter style={enter(2)}>{post.excerpt}</p>
          </div>
        </header>

        <div className={`bp-wrap nr-story${paragraphs.length ? "" : " is-brief"}`}>
          {paragraphs.length > 0 && (
            <div className="nr-story-body">
              {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          )}
          <aside className="nr-story-side" aria-label="About this post">
            <dl className="nr-facts">
              <div><dt>Published</dt><dd><time dateTime={post.date}>{formatDate(post.date)}</time></dd></div>
              <div><dt>Category</dt><dd><CategoryTag category={post.category} /></dd></div>
              <div><dt>Reading time</dt><dd>{readingMinutes(post.body || post.excerpt)} min</dd></div>
            </dl>
            <div className="nr-story-actions">
              <CopyLink className="bp-button is-ghost is-small" />
              <Link href={section.href} className="nr-back"><ArrowLeft size={14} aria-hidden="true" />{section.allLabel}</Link>
            </div>
          </aside>
        </div>
      </article>

      {more.length > 0 && (
        <section className="bp-wrap nr-more" aria-labelledby="nr-more-title">
          <header className="bp-head">
            <h2 id="nr-more-title">{section.moreTitle}</h2>
            <i aria-hidden="true" />
            <p><Link href={section.href}>{section.allLabel}</Link></p>
          </header>
          <ol className="nr-list">
            {more.map((story) => <li key={story.id}><PostRow story={story} /></li>)}
          </ol>
        </section>
      )}
    </main>
  );
}
