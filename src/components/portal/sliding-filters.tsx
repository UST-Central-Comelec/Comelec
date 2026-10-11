"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode, type RefObject } from "react";

export type FilterItem = { key: string; href: string; label: ReactNode };
type Box = { left: number; top: number; width: number; height: number; danger: boolean };

/** All pill selectors measure their actual selected control, including wrapped rows. */
function useHighlight(strip: RefObject<HTMLElement | null>, selector: string, active: string | boolean, items: unknown, storageKey?: string) {
  const mounted = useRef(false);
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const element = strip.current;
    if (!element) return;
    let frame = 0;
    const measure = (control: HTMLElement | null): Box | null => control && control.offsetWidth > 0 ? { left: control.offsetLeft, top: control.offsetTop, width: control.offsetWidth, height: control.offsetHeight, danger: control.classList.contains("is-closed") } : null;
    const update = (next: Box | null) => setBox(previous => previous && next && previous.left === next.left && previous.top === next.top && previous.width === next.width && previous.height === next.height && previous.danger === next.danger ? previous : next);
    const place = () => update(measure(element.querySelector<HTMLElement>(selector)));
    let previous: string | null = null;
    if (!mounted.current) {
      mounted.current = true;
      if (storageKey) try {
        const pending = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
        sessionStorage.removeItem(storageKey);
        if (pending?.to === active && Date.now() - pending.at < 10_000) previous = pending.from;
      } catch { /* Browser storage is optional. */ }
    }
    const oldControl = previous ? Array.from(element.querySelectorAll<HTMLElement>("[data-filter-key]")).find(control => control.dataset.filterKey === previous) ?? null : null;
    const previousBox = measure(oldControl);
    let restoring = Boolean(previousBox);
    if (previousBox) {
      update(previousBox);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => { restoring = false; place(); });
      });
    } else place();
    const observer = new ResizeObserver(() => { if (!restoring) place(); });
    observer.observe(element);
    for (const control of element.querySelectorAll("a, button, label")) observer.observe(control);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [active, items, selector, storageKey, strip]);
  return box;
}

function Highlight({ box, segmented = false }: { box: Box | null; segmented?: boolean }) {
  return box && <i className={`${segmented ? "portal-segmented-thumb" : "portal-filters-thumb"}${box.danger ? " is-danger" : ""}`} style={{ width: box.width, height: box.height, top: 0, bottom: "auto", transform: `translate(${box.left}px, ${box.top}px)` }} aria-hidden="true" />;
}

/** Local view switches use the same animation as URL filters. */
export function SlidingFilterButtons<Key extends string>({ items, active, label, onChange }: {
  items: { key: Key; label: ReactNode }[];
  active: Key;
  label: string;
  onChange: (key: Key) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const box = useHighlight(strip, '[aria-pressed="true"]', active, items);
  return <div ref={strip} className={`portal-filters is-sliding${box ? " is-placed" : ""}`} role="group" aria-label={label}>
    <Highlight box={box} />
    {items.map(item => <button key={item.key} type="button" className={active === item.key ? "is-active" : undefined} aria-pressed={active === item.key} onClick={() => onChange(item.key)}>{item.label}</button>)}
  </div>;
}

/** Filter navigation animates immediately and retains its starting position across page mounts. */
export function SlidingFilters({ items, active, label }: { items: FilterItem[]; active: string; label: string }) {
  const strip = useRef<HTMLElement>(null);
  const [picked, setPicked] = useState(active);
  const [seen, setSeen] = useState(active);
  if (active !== seen) { setSeen(active); setPicked(active); }
  const storageKey = `portal-filters:${label}:${items.map(item => `${item.key}@${item.href.split("?")[0]}`).join("|")}`;
  const box = useHighlight(strip, '[data-picked="true"]', picked, items, storageKey);
  return <nav ref={strip} className={`portal-filters is-sliding${box ? " is-placed" : ""}`} aria-label={label}>
    <Highlight box={box} />
    {items.map(item => <Link key={item.key} href={item.href} scroll={false} data-filter-key={item.key} data-picked={picked === item.key} className={picked === item.key ? "is-active" : undefined} aria-current={active === item.key ? "true" : undefined} onNavigate={() => {
      try { sessionStorage.setItem(storageKey, JSON.stringify({ from: picked, to: item.key, at: Date.now() })); } catch { /* Storage is optional. */ }
      setPicked(item.key);
    }}>{item.label}</Link>)}
  </nav>;
}

/** Radio pill groups keep their native inputs and keyboard behavior with a shared sliding fill. */
export function SlidingSegments({ active, children, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { active: string | boolean; children: ReactNode }) {
  const strip = useRef<HTMLDivElement>(null);
  const box = useHighlight(strip, ".portal-segment.is-selected", active, children);
  return <div {...props} ref={strip} className={`portal-segmented is-sliding${box ? " is-placed" : ""} ${className}`}>
    <Highlight box={box} segmented />{children}
  </div>;
}
