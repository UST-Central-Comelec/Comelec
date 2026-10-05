"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { FeaturedCarousel, type Featured } from "@/components/featured-carousel";
import { isCurrent, type NavSection, type NavStatus } from "@/components/nav/nav-data";
import { LinkBody } from "@/components/nav/nav-parts";
import { useReticle } from "@/components/nav/use-reticle";
import { NightSky } from "@/components/night-sky";

type MegaMenuProps = {
  id: string;
  open: boolean;
  /** The menu showing, or the one last shown while it folds away. */
  section: NavSection | null;
  /** Goes up each time the menu opens from shut, so its entrance plays again. */
  opening: number;
  /** Switching tabs with the menu open: the side the new links come in from. */
  entrance: "left" | "right" | null;
  status: NavStatus;
  pathname: string;
  featured: Featured[];
  featuredIndex: number;
  onFeaturedIndexChange: (index: number) => void;
  onNavigate: () => void;
  /** Tab off either end of the menu: "back" to the tab it hangs from, or "on" past it. */
  onExit: (direction: "back" | "on") => void;
};

/** The panel's corner radius, and how far its point rises and spreads. Match header.css (.sh-mega-panel). */
const RADIUS = 24;
const POINT_RISE = 12;
const POINT_SPREAD = 14;
/** Switching tabs, the point takes this long (ms) to slide over to the new one. */
const POINT_SLIDE = 350;

/**
 * The panel's outline as one path: a rounded box whose top edge rises to a soft point at `x`. The
 * panel is clipped to it and its rim is drawn along it, so the point is the panel, not a piece on it.
 */
function outline(width: number, height: number, x: number) {
  const r = Math.min(RADIUS, height / 2);
  const top = POINT_RISE;
  const at = Math.min(Math.max(x, r + POINT_SPREAD + 6), width - r - POINT_SPREAD - 6);
  const n = (value: number) => value.toFixed(2);
  // Up one flank and down the other, eased where it leaves the edge and rounded at the top.
  const flank = (side: 1 | -1) => {
    const foot = at - side * POINT_SPREAD;
    return {
      out: `${n(foot - side * 4)},${top}`,
      foot: `${n(foot)},${top}`,
      low: `${n(foot + side * POINT_SPREAD * 0.26)},${n(top - POINT_RISE * 0.26)}`,
      high: `${n(at - side * POINT_SPREAD * 0.2)},${n(top - POINT_RISE * 0.8)}`,
    };
  };
  const left = flank(1);
  const right = flank(-1);
  return [
    `M${r},${top}`,
    `L${left.out} Q${left.foot} ${left.low} L${left.high} Q${n(at)},0 ${right.high} L${right.low} Q${right.foot} ${right.out}`,
    `L${n(width - r)},${top} A${r},${r} 0 0 1 ${n(width)},${top + r}`,
    `L${n(width)},${n(height - r)} A${r},${r} 0 0 1 ${n(width - r)},${n(height)}`,
    `L${r},${n(height)} A${r},${r} 0 0 1 0,${n(height - r)}`,
    `L0,${top + r} A${r},${r} 0 0 1 ${r},${top} Z`,
  ].join(" ");
}

/**
 * The menu under the navbar's tabs: a glass panel with its own night sky, whose top edge rises to a
 * point under the tab it hangs from. On the left, the section's
 * headline; in the middle, its links, with a reticle that locks on to the one being pointed at; on
 * the right, the Featured carousel; and along the foot, the Live mark and the way to the section
 * itself.
 */
export function MegaMenu({ id, open, section, opening, entrance, status, pathname, featured, featuredIndex, onFeaturedIndexChange, onNavigate, onExit }: MegaMenuProps) {
  const { field, reticle, lock } = useReticle();
  const sectionId = section?.id;

  // Nothing's pointed at in a menu that has just opened, switched or shut.
  useEffect(() => lock(null), [lock, sectionId, opening, open]);

  const panelRef = useRef<HTMLDivElement>(null);
  const rimRef = useRef<SVGPathElement>(null);
  /** Where the point is drawn, and the frame of its slide if it's on the move. */
  const point = useRef<{ x: number | null; frame: number }>({ x: null, frame: 0 });

  // The panel's shape: cut to its outline, with the point under the tab whose menu is open. Drawn
  // through styles rather than state, so the point sliding between tabs never re-renders the menu.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const root = panel?.parentElement;
    if (!panel || !root) return;

    const draw = (x: number) => {
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      if (!width || !height) return;
      point.current.x = x;
      const path = outline(width, height, x);
      panel.style.clipPath = `path("${path}")`;
      rimRef.current?.setAttribute("d", path);
    };
    /** The middle of the open tab, measured from the panel's left edge (off `root`, which the panel's entrance doesn't move). */
    const aim = () => {
      const tab = open ? root.closest(".site-header")?.querySelector<HTMLElement>('.sh-tab[aria-expanded="true"]') : null;
      if (!tab) return point.current.x ?? panel.offsetWidth / 2;
      const { left, width } = tab.getBoundingClientRect();
      return left + width / 2 - root.getBoundingClientRect().left;
    };

    const from = point.current.x;
    const to = aim();
    if (open && entrance && from !== null && from !== to && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - started) / POINT_SLIDE, 1);
        draw(from + (to - from) * (1 - (1 - t) ** 3));
        point.current.frame = t < 1 ? requestAnimationFrame(step) : 0;
      };
      step(started);
    } else draw(to);

    // The panel changes height from one tab's menu to the next, and width with the window.
    const slide = point.current;
    const observer = new ResizeObserver(() => draw(slide.frame ? (slide.x ?? aim()) : aim()));
    observer.observe(panel);
    return () => {
      cancelAnimationFrame(slide.frame);
      slide.frame = 0;
      observer.disconnect();
    };
  }, [open, entrance, sectionId, opening]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const stops = [...event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)")].filter((element) => !element.closest("[inert]"));
    if (document.activeElement !== (event.shiftKey ? stops[0] : stops[stops.length - 1])) return;
    event.preventDefault();
    onExit(event.shiftKey ? "back" : "on");
  };

  // Keyed by tab (and by each opening), so the headline and links mount fresh and play their entrance; the Featured column stays put.
  const stamp = `${sectionId}:${opening}`;
  const enter = entrance ? ` is-switching from-${entrance}` : " is-opening";

  return (
    <div id={id} className={`sh-mega${open ? " is-open" : ""}`} inert={!open} onKeyDown={handleKeyDown}>
      <div ref={panelRef} className={`sh-mega-panel${featured.length ? " has-featured" : ""}`}>
        <NightSky seed={93} count={46} meteors={false} />
        <svg className="sh-mega-rim" aria-hidden="true"><path ref={rimRef} /></svg>
        {section && (
          <div className="sh-mega-grid">
            <div className={`sh-mega-intro${enter}`} key={`intro:${stamp}`}>
              <p className="sh-mega-title">{section.title} <em>{section.accent}</em></p>
              <p className="sh-mega-blurb">{section.blurb}</p>
            </div>
            <div
              className="sh-mega-links"
              ref={field}
              onPointerLeave={() => lock(null)}
              onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) lock(null); }}
            >
              <span ref={reticle} className="sh-reticle" aria-hidden="true" />
              <ul className={`sh-mega-list${enter}`} key={`list:${stamp}`} aria-label={section.label}>
                {section.items.map((item, index) => (
                  <li key={item.label} style={{ "--i": index } as CSSProperties}>
                    <Link
                      href={item.href}
                      className="sh-mega-link"
                      aria-current={isCurrent(item.href, pathname) ? "page" : undefined}
                      onClick={onNavigate}
                      onPointerEnter={(event) => { if (event.pointerType === "mouse") lock(event.currentTarget); }}
                      onFocus={(event) => lock(event.currentTarget)}
                    >
                      <LinkBody item={item} status={status} />
                      <ArrowUpRight className="sh-mega-arrow" size={15} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <FeaturedCarousel items={featured} index={featuredIndex} onIndexChange={onFeaturedIndexChange} playing={open} onNavigate={onNavigate} />
          </div>
        )}
        <div className="sh-mega-hud">
          <p className="sh-hud-live"><span className="sh-bars" aria-hidden="true"><i /><i /><i /><i /></span>Live</p>
          {section && <Link href={section.cta.href} className="sh-mega-cta" onClick={onNavigate}>{section.cta.label}<ArrowUpRight size={14} aria-hidden="true" /></Link>}
        </div>
      </div>
    </div>
  );
}
