import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";

const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

/** The COMET introduction; the full landing view switches in home-views.tsx. */
export function HeroContent() {
  return (
    <div className="lp-hero-inner">
      <p className="lp-kicker" data-enter style={enter(1)}>UST Central Comelec presents</p>
      <h1 id="lp-title" className="lp-hero-title">
        <span className="lp-wordmark" data-enter style={enter(2)}>COMET</span>
        <span className="visually-hidden">: </span>
        <span className="lp-tagline" data-enter style={enter(3)}>
          Elections, <em>illuminated.</em>
        </span>
      </h1>
      <p className="lp-lede" data-enter style={enter(4)}>
        The <strong>COMELEC Engagement and Transparency Technology</strong> initiative serves as a centralized digital platform for UST Central COMELEC—connecting elections, official records, archives, news, applications, public engagements, and transparency initiatives in one accessible space.
      </p>
      <div className="lp-actions" data-enter style={enter(5)}>
        <a href="#comet" className="lp-button is-primary is-down">Explore the initiative <ArrowDown size={16} aria-hidden="true" /></a>
        <Link href="/news" className="lp-button is-ghost">Latest from the commission <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}
