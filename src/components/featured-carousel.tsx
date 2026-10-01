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

/** A card's footnote, split before its last word: that word and the arrow wrap as one. */
const lastWord = (text: string) => text.lastIndexOf(" ") + 1;

/**
 * The Featured column beside the links in every dropdown: one card at a time, sliding between them.
 * It moves on by itself when the active dot's progress bar fills (so pausing the bar pauses the
 * carousel), and holds still while hovered or focused, while the menu is shut, or with reduced
 * motion. Touch screens can swipe. The header keeps `index`, so switching dropdowns doesn't reset it.
 * Each card catches a soft gold light under the mouse (--spot-x/--spot-y), like the home page's cards.
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
      className="sh-feat"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false); }}
    >
      <div
        className="sh-feat-viewport"
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
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
          const card = (event.target as Element).closest<HTMLElement>(".sh-feat-card");
          if (!card) return;
          const box = card.getBoundingClientRect();
          card.style.setProperty("--spot-x", `${Math.round(event.clientX - box.left)}px`);
          card.style.setProperty("--spot-y", `${Math.round(event.clientY - box.top)}px`);
        }}
      >
        <div className="sh-feat-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {items.map((item, itemIndex) => (
            <div className="sh-feat-slide" key={item.id} role="group" aria-roledescription="slide" aria-label={`${itemIndex + 1} of ${count}`} inert={itemIndex !== current}>
              <Link href={item.href} className="sh-feat-card" onClick={onNavigate}>
                <span className={`sh-feat-tag is-${item.tone}`}>{item.tone === "live" && <i aria-hidden="true" />}{item.tag}</span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
                <span className="sh-feat-foot">{item.footnote.slice(0, lastWord(item.footnote))}<span>{item.footnote.slice(lastWord(item.footnote))}<ArrowUpRight size={14} aria-hidden="true" /></span></span>
              </Link>
            </div>
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className="sh-feat-nav">
          <div className={`sh-feat-dots${moving ? "" : " is-held"}`}>
            {items.map((item, itemIndex) => (
              <button type="button" key={item.id} className={itemIndex === current ? "is-current" : undefined} onClick={() => go(itemIndex)} aria-label={`Show featured item ${itemIndex + 1}: ${item.title}`} aria-current={itemIndex === current || undefined}>
                <span onAnimationEnd={() => go(current + 1)} />
              </button>
            ))}
          </div>
          <div className="sh-feat-arrows">
            <button type="button" onClick={() => go(current - 1)} aria-label="Previous featured item"><ChevronLeft size={15} /></button>
            <button type="button" onClick={() => go(current + 1)} aria-label="Next featured item"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
