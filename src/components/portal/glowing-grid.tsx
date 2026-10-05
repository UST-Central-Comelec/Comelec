"use client";

import { useEffect, useRef, type ReactNode } from "react";
import "./glowing-grid.css";

/** A shared pointer listener lights nearby card edges without rerendering their contents. */
export function GlowingGrid({ className, children }: { className?: string; children: ReactNode }) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-glow]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const angles = new WeakMap<HTMLElement, number>();
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;

    const reset = () => {
      pointer = null;
      cancelAnimationFrame(frame);
      frame = 0;
      cards.forEach((card) => card.style.setProperty("--dashboard-glow-opacity", "0"));
    };

    const update = () => {
      frame = 0;
      if (!pointer) return;
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const x = pointer.x - rect.left;
        const y = pointer.y - rect.top;
        const outside = Math.hypot(Math.max(-x, 0, x - rect.width), Math.max(-y, 0, y - rect.height));
        const inCenter = Math.hypot(x - rect.width / 2, y - rect.height / 2) < Math.min(rect.width, rect.height) * .28;
        const opacity = inCenter ? 0 : Math.max(0, 1 - outside / 80);
        card.style.setProperty("--dashboard-glow-opacity", String(opacity));
        if (!opacity) continue;
        const target = Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI + 90;
        const previous = angles.get(card) ?? target;
        // Unwrap the angle so crossing twelve o'clock takes the shortest path.
        const angle = previous + ((target - previous + 540) % 360 + 360) % 360 - 180;
        angles.set(card, angle);
        card.style.setProperty("--dashboard-glow-angle", `${angle}deg`);
      }
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reducedMotion.matches) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("scroll", reset, { passive: true, capture: true });
    window.addEventListener("resize", reset);
    reducedMotion.addEventListener("change", reset);
    return () => {
      reset();
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("scroll", reset, true);
      window.removeEventListener("resize", reset);
      reducedMotion.removeEventListener("change", reset);
    };
  }, [children]);

  return <div ref={gridRef} className={`dashboard-glowing-grid ${className ?? ""}`}>{children}</div>;
}
