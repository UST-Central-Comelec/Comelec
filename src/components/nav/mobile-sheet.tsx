"use client";

import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { FeaturedCarousel, type Featured } from "@/components/featured-carousel";
import { isCurrent, sectionFor, sections, two, type NavStatus } from "@/components/nav/nav-data";
import { LinkBody, Readings } from "@/components/nav/nav-parts";
import { NightSky } from "@/components/night-sky";
import { SiteThemeToggle } from "@/components/site-theme";

type SheetProps = {
  status: NavStatus;
  pathname: string;
  featured: Featured[];
  featuredIndex: number;
  onFeaturedIndexChange: (index: number) => void;
  /** A link was picked: the menu closes. */
  onNavigate: () => void;
  onSearch: () => void;
};

/** The menu's contents. Mounted fresh each time it opens, on the section of the page you're on. */
function SheetBody({ id, open, status, pathname, featured, featuredIndex, onFeaturedIndexChange, onNavigate, onSearch }: SheetProps & { id: string; open: boolean }) {
  const [expanded, setExpanded] = useState(() => sectionFor(pathname));

  return (
    <nav className="sh-sheet-scroll" aria-label="Menu" data-lenis-prevent>
      <ul className="sh-acc-list">
        {sections.map((section, index) => {
          const isOpen = expanded === section.id;
          return (
            <li className={`sh-acc${isOpen ? " is-open" : ""}`} key={section.id} style={{ "--i": index } as CSSProperties}>
              <button type="button" className="sh-acc-head" aria-expanded={isOpen} aria-controls={`${id}-${section.id}`} onClick={() => setExpanded(isOpen ? null : section.id)}>
                <span className="sh-acc-index" aria-hidden="true">{two(index + 1)}</span>
                <span className="sh-acc-label">{section.label}</span>
                <span className="sh-acc-sign" aria-hidden="true" />
              </button>
              <div className="sh-acc-body" id={`${id}-${section.id}`} inert={!isOpen}>
                <div>
                  <ul className="sh-acc-links">
                    {section.items.map((item) => (
                      <li key={item.label}>
                        <Link href={item.href} className="sh-mega-link" aria-current={isCurrent(item.href, pathname) ? "page" : undefined} onClick={onNavigate}>
                          <LinkBody item={item} status={status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={section.cta.href} className="sh-mega-cta" onClick={onNavigate}>{section.cta.label}<ArrowUpRight size={14} aria-hidden="true" /></Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sh-sheet-extra" style={{ "--i": sections.length } as CSSProperties}>
        <FeaturedCarousel items={featured} index={featuredIndex} onIndexChange={onFeaturedIndexChange} playing={open} onNavigate={onNavigate} />
        <div className="sh-sheet-actions">
          <Link href="/news" className="sh-cta" onClick={onNavigate}>EvoSys<ArrowUpRight size={15} aria-hidden="true" /></Link>
          <button type="button" className="sh-search" onClick={onSearch}><Search size={16} strokeWidth={1.8} aria-hidden="true" /><span>Search</span></button>
        </div>
        <p className="sh-sheet-theme"><span>Appearance</span><SiteThemeToggle /></p>
        <Readings status={status} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

/**
 * The navbar's menu where there's no room for tabs (phones, tablets): the whole screen, opening out
 * from the menu button. The sections are an accordion of the same links as the dropdowns, over the
 * Featured carousel, EvoSys, search and what's open right now; behind them, a night sky above a
 * planet's gold horizon, as at the foot of the home page.
 */
export function MobileSheet({ id, open, session, ...body }: SheetProps & { id: string; open: boolean; session: number }) {
  return (
    <div id={id} className={`sh sh-sheet${open ? " is-open" : ""}`} inert={!open}>
      <NightSky seed={42} count={64} meteors={false} />
      <i className="sh-sheet-horizon" aria-hidden="true" />
      <SheetBody key={session} id={id} open={open} {...body} />
    </div>
  );
}
