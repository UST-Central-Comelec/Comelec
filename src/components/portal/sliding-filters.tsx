"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type FilterItem = { key: string; href: string; label: ReactNode };

/** Local view switches with the same sliding highlight as the URL filters. */
export function SlidingFilterButtons<Key extends string>({ items, active, label, onChange }: {
  items: { key: Key; label: ReactNode }[];
  active: Key;
  label: string;
  onChange: (key: Key) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const element = strip.current;
    if (!element) return;
    const place = () => {
      const button = element.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      if (button && button.offsetWidth > 0) {
        setBox({ left: button.offsetLeft, top: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight });
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    for (const button of element.querySelectorAll("button")) observer.observe(button);
    return () => observer.disconnect();
  }, [active, items]);

  return (
    <div ref={strip} className={`portal-filters is-sliding${box ? " is-placed" : ""}`} role="group" aria-label={label}>
      {box && <i className="portal-filters-thumb" style={{ width: box.width, height: box.height, top: 0, bottom: "auto", transform: `translate(${box.left}px, ${box.top}px)` }} aria-hidden="true" />}
      {items.map(item => (
        <button key={item.key} type="button" className={active === item.key ? "is-active" : undefined} aria-pressed={active === item.key} onClick={() => onChange(item.key)}>{item.label}</button>
      ))}
    </div>
  );
}

/**
 * A strip of filter links whose highlight slides from the old choice to the new one. The pick shows
 * straight away, before the list behind it has loaded; `active` (from the URL) settles it.
 */
export function SlidingFilters({ items, active, label }: { items: FilterItem[]; active: string; label: string }) {
  const strip = useRef<HTMLElement>(null);
  const [picked, setPicked] = useState(active);
  const [seen, setSeen] = useState(active);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  if (active !== seen) {
    setSeen(active);
    setPicked(active);
  }

  useLayoutEffect(() => {
    const element = strip.current;
    if (!element) return;
    const place = () => {
      const link = element.querySelector<HTMLElement>('[data-picked="true"]');
      if (link && link.offsetWidth > 0) {
        setBox({ left: link.offsetLeft, top: link.offsetTop, width: link.offsetWidth, height: link.offsetHeight });
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    for (const link of element.querySelectorAll("a")) observer.observe(link);
    return () => observer.disconnect();
  }, [picked, items]);

  return (
    <nav ref={strip} className={`portal-filters is-sliding${box ? " is-placed" : ""}`} aria-label={label}>
      {box && <i className="portal-filters-thumb" style={{ width: box.width, height: box.height, top: 0, bottom: "auto", transform: `translate(${box.left}px, ${box.top}px)` }} aria-hidden="true" />}
      {items.map((item) => (
        <Link key={item.key} href={item.href} scroll={false} data-picked={picked === item.key} className={picked === item.key ? "is-active" : undefined} aria-current={active === item.key ? "true" : undefined} onNavigate={() => setPicked(item.key)}>{item.label}</Link>
      ))}
    </nav>
  );
}
