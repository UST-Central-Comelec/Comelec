"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Tab = { key: string; href: string; label: ReactNode };
type Line = { left: number; width: number };

/** A shared underline moves immediately on navigation and survives the destination's mount. */
export function SlidingSubtabs({ items, active, label, scope, className = "" }: {
  items: Tab[];
  active: string;
  label: string;
  scope: string;
  className?: string;
}) {
  const strip = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  const [picked, setPicked] = useState(active);
  const [seen, setSeen] = useState(active);
  const [line, setLine] = useState<Line | null>(null);
  const storageKey = `portal-subtabs:${scope}`;
  if (active !== seen) {
    setSeen(active);
    setPicked(active);
  }

  useLayoutEffect(() => {
    const nav = strip.current;
    if (!nav) return;
    let frame = 0;
    const measure = (key: string): Line | null => {
      const link = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a[data-tab]")).find(link => link.dataset.tab === key);
      return link && link.offsetWidth > 0 ? { left: link.offsetLeft, width: link.offsetWidth } : null;
    };
    const place = () => setLine(measure(picked));
    let previous: string | null = null;
    if (!mounted.current) {
      mounted.current = true;
      try {
        const pending = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
        sessionStorage.removeItem(storageKey);
        if (pending?.to === active && Date.now() - pending.at < 10_000) previous = pending.from;
      } catch { /* Navigation still works when browser storage is unavailable. */ }
    }
    const previousLine = previous ? measure(previous) : null;
    let restoring = Boolean(previousLine);
    if (previousLine) {
      setLine(previousLine);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => { restoring = false; place(); });
      });
    } else place();
    const observer = new ResizeObserver(() => { if (!restoring) place(); });
    observer.observe(nav);
    for (const link of nav.querySelectorAll("a")) observer.observe(link);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [active, picked, items, storageKey]);

  return (
    <nav ref={strip} className={`portal-subtabs is-sliding${line ? " is-placed" : ""} ${className}`} aria-label={label}>
      {line && <span className="portal-subtabs-line" style={{ width: line.width, transform: `translateX(${line.left}px)` }} aria-hidden="true" />}
      {items.map(item => (
        <Link key={item.key} href={item.href} scroll={false} data-tab={item.key} data-picked={picked === item.key} aria-current={active === item.key ? "page" : undefined} onNavigate={() => {
          try { sessionStorage.setItem(storageKey, JSON.stringify({ from: picked, to: item.key, at: Date.now() })); } catch { /* Storage is optional. */ }
          setPicked(item.key);
        }}>{item.label}</Link>
      ))}
    </nav>
  );
}
