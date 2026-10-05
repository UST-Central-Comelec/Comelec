"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Compact page tabs. The selected background moves on click, before the next page has loaded.
 */
export function SquishTabs({ tabs, label }: { tabs: Array<{ href: string; label: string }>; label: string }) {
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

  const rect = rects?.[activeIndex];
  const thumbStyle: CSSProperties | undefined = rect && {
    left: rect.left,
    right: navWidth - rect.left - rect.width,
  };

  return (
    <nav ref={navRef} className={`squish-tabs${rect ? " is-ready" : ""}`} aria-label={label}>
      {rect && (
        <span className="squish-tabs-thumb" style={thumbStyle} aria-hidden="true">
          <span />
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
