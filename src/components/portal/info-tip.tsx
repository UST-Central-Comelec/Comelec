"use client";

import { useId, useRef, type ReactNode } from "react";
import { Info, TriangleAlert } from "lucide-react";

/** How close a tip may come to the edge of the window, in px. */
const EDGE = 12;

/**
 * An "i" icon that shows guide text on hover or keyboard focus. The portal keeps explanations in
 * these rather than as text under headings and fields, so pages stay uncluttered. The tip opens
 * below the icon, running right; near the window's right edge it slides back so none of it is cut off.
 * `warn` makes it a warning sign instead, for something to know before relying on what it's beside.
 */
export function InfoTip({ children, label = "More info", warn = false, icon }: { children: ReactNode; label?: string; warn?: boolean; icon?: ReactNode }) {
  const id = useId();
  const tip = useRef<HTMLSpanElement>(null);

  const place = () => {
    const element = tip.current;
    if (!element) return;
    element.style.setProperty("--tip-shift", "0px");
    const past = element.getBoundingClientRect().right - (document.documentElement.clientWidth - EDGE);
    if (past > 0) element.style.setProperty("--tip-shift", `${-Math.ceil(past)}px`);
  };

  return (
    <span className={`portal-info${warn ? " is-warn" : ""}`} onPointerEnter={place} onFocus={place}>
      <button type="button" className="portal-info-button" aria-label={label} aria-describedby={id}>
        {icon ?? (warn ? <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" /> : <Info size={14} strokeWidth={2} aria-hidden="true" />)}
      </button>
      <span ref={tip} className="portal-info-tip" role="tooltip" id={id}>{children}</span>
    </span>
  );
}

/** A page or card heading with its guide text behind an "i" icon. */
export function TitleWithInfo({ as: Tag = "h1", className, id, info, children }: { as?: "h1" | "h2"; className?: string; id?: string; info: ReactNode; children: ReactNode }) {
  return (
    <div className="portal-title-row">
      <Tag className={className} id={id}>{children}</Tag>
      <InfoTip>{info}</InfoTip>
    </div>
  );
}
