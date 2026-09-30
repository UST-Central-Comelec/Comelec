"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";

/** A card in the menu's Featured carousel; built in the site layout. */
export type Featured = {
  id: string;
  href: string;
  tag: string;
  /** "live" shows a green dot, for something open right now. */
  tone: "live" | "news";
  title: string;
  description: string;
  footnote: string;
};

/**
 * The Featured column beside the links in every dropdown: one card at a time, sliding between them.
 * It moves on by itself when the active dot's progress bar fills (so pausing the bar pauses the
 * carousel), and holds still while hovered or focused, while the menu is shut, or with reduced
 * motion. Touch screens can swipe. The header keeps `index`, so switching dropdowns doesn't reset it.
 */
export function FeaturedCarousel({ items, index, onIndexChange, playing, onNavigate }: { items: Featured[]; index: number; onIndexChange: (index: number) => void; playing: boolean; onNavigate: () => void }) {
  const [held, setHeld] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const count = items.length;
  if (!count) return null;

  const current = Math.min(index, count - 1);
  const go = (next: number) => onIndexChange((next + count) % count);
  const moving = count > 1 && playing && !held;

  return (
    <div
      className="mega-featured"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false); }}
    >
      <div className="mega-featured-head">
        <span className="dropdown-label">Featured</span>
        {count > 1 && (
          <div className="mega-featured-arrows">
            <button type="button" onClick={() => go(current - 1)} aria-label="Previous featured item"><ChevronLeft size={15} /></button>
            <button type="button" onClick={() => go(current + 1)} aria-label="Next featured item"><ChevronRight size={15} /></button>
          </div>
        )}
      </div>
      <div
        className="mega-featured-viewport"
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured"
        onPointerDown={(event) => { if (event.pointerType === "touch") swipeStart.current = event.clientX; }}
        onPointerUp={(event) => {
          if (swipeStart.current === null) return;
          const distance = event.clientX - swipeStart.current;
          swipeStart.current = null;
          if (Math.abs(distance) > 40) go(current + (distance < 0 ? 1 : -1));
        }}
        onPointerCancel={() => { swipeStart.current = null; }}
      >
        <div className="mega-featured-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {items.map((item, itemIndex) => (
            <div className="mega-featured-slide" key={item.id} role="group" aria-roledescription="slide" aria-label={`${itemIndex + 1} of ${count}`} inert={itemIndex !== current}>
              <Link href={item.href} className="mega-featured-card" onClick={onNavigate}>
                <span className={`mega-featured-tag is-${item.tone}`}>{item.tone === "live" && <i aria-hidden="true" />}{item.tag}</span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
                <span className="mega-featured-foot">{item.footnote}<ArrowUpRight size={14} aria-hidden="true" /></span>
              </Link>
            </div>
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className={`mega-featured-dots${moving ? "" : " is-held"}`}>
          {items.map((item, itemIndex) => (
            <button type="button" key={item.id} className={itemIndex === current ? "is-current" : undefined} onClick={() => go(itemIndex)} aria-label={`Show featured item ${itemIndex + 1}: ${item.title}`} aria-current={itemIndex === current || undefined}>
              <span onAnimationEnd={() => go(current + 1)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
