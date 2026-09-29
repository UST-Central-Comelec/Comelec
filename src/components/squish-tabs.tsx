"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Page tabs drawn as a switch whose thumb squishes as it slides: the edge heading toward the new
 * tab leaves first and the other edge catches up, so the thumb stretches mid-move, squashes a
 * little, then settles. The thumb moves on click, before the next page has loaded.
 */
export function SquishTabs({ tabs, label, stretchLag = 55, duration = 380 }: { tabs: Array<{ href: string; label: string }>; label: string; stretchLag?: number; duration?: number }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const [rects, setRects] = useState<Array<{ left: number; width: number }> | null>(null);
  const [navWidth, setNavWidth] = useState(0);

  // A click shows its tab straight away; once the route changes (including Back/Forward), the URL
  // is the truth again.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setClicked(null);
  }
  const activeHref = clicked && clicked.from === pathname ? clicked.href : pathname;
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.href === activeHref));

  // Remember which way the thumb last moved, to know which edge leads.
  const [shown, setShown] = useState({ index: activeIndex, direction: 0 });
  if (shown.index !== activeIndex) setShown({ index: activeIndex, direction: Math.sign(activeIndex - shown.index) });

  // Measure the tabs (and again whenever the layout changes size).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const links = [...nav.querySelectorAll<HTMLElement>("[data-squish-tab]")];
      setRects(links.map((link) => ({ left: link.offsetLeft, width: link.offsetWidth })));
      setNavWidth(nav.clientWidth);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  const rect = rects?.[shown.index];
  const leading = `${duration}ms cubic-bezier(.3, 1.35, .5, 1)`;
  const trailing = `${duration}ms cubic-bezier(.3, 1.35, .5, 1) ${stretchLag}ms`;
  const thumbStyle: CSSProperties | undefined = rect && {
    left: rect.left,
    right: navWidth - rect.left - rect.width,
    // Moving right: the right edge leads. Moving left: the left edge leads.
    transition: shown.direction > 0 ? `right ${leading}, left ${trailing}` : shown.direction < 0 ? `left ${leading}, right ${trailing}` : "none",
  };

  return (
    <nav ref={navRef} className={`squish-tabs${rect ? " is-ready" : ""}`} aria-label={label}>
      {rect && (
        <span className="squish-tabs-thumb" style={thumbStyle} aria-hidden="true">
          {/* Remounted on every move so the squash plays again. */}
          <span key={`${shown.index}-${shown.direction}`} className={shown.direction ? "is-moving" : undefined} />
        </span>
      )}
      {tabs.map((tab, index) => (
        <Link
          key={tab.href}
          href={tab.href}
          data-squish-tab
          className={index === activeIndex ? "is-active" : undefined}
          aria-current={pathname === tab.href ? "page" : undefined}
          onClick={() => { if (tab.href !== activeHref) setClicked({ href: tab.href, from: pathname }); }}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
