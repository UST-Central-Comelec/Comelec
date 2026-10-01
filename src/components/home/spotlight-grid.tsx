"use client";

import type { ReactNode } from "react";

/** A grid whose cards ([data-spotlight]) catch a soft light under the mouse, through --spot-x/--spot-y. */
export function SpotlightGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={className}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const card = (event.target as Element).closest<HTMLElement>("[data-spotlight]");
        if (!card) return;
        const box = card.getBoundingClientRect();
        card.style.setProperty("--spot-x", `${Math.round(event.clientX - box.left)}px`);
        card.style.setProperty("--spot-y", `${Math.round(event.clientY - box.top)}px`);
      }}
    >
      {children}
    </div>
  );
}
