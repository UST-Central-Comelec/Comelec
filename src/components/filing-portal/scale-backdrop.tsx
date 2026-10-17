"use client";

import { ComelecBackdrop } from "@/components/home/comelec-backdrop";
import type { ScaleLayout } from "@/components/home/justice-scale";

/* The filing portal sign-in's backdrop: the Central Comelec's justice scale from the Student Government
   landing, towering between the pitch and the card with its beam over the top. */

/** Where the scale goes on the sign-in page, read off the backdrop's box and the pitch. */
function place(page: HTMLElement): ScaleLayout | null {
  const backdrop = page.querySelector(".pp-scale");
  const kicker = page.querySelector(".portal-login-kicker");
  const title = page.querySelector(".portal-login-title");
  const brand = page.querySelector(".portal-login-aside > .portal-brand");
  const box = backdrop?.getBoundingClientRect();
  if (!box || !box.width || !box.height || !title) return null;
  const { width, height } = box;
  // The heading's lines are blocks as wide as the pitch: measure the words themselves, from their text.
  const lines = [...title.querySelectorAll(".portal-login-wordmark, em")].flatMap((line) => [...line.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE)).map((text) => {
    const words = document.createRange();
    words.selectNodeContents(text);
    return words.getBoundingClientRect();
  });
  const whole = title.getBoundingClientRect();
  const t = lines.length ? { left: Math.min(...lines.map((line) => line.left)), top: whole.top, right: Math.max(...lines.map((line) => line.right)), bottom: whole.bottom } : whole;
  const k = kicker?.getBoundingClientRect() ?? t;
  // The brief is hidden on a phone; the heading then ends the text.
  const brief = page.querySelector(".portal-login-brief")?.getBoundingClientRect();
  const l = brief && brief.height ? brief : t;
  const b = brand?.getBoundingClientRect();
  // Side by side (wider than 980px), the scale stands in the gap between the pitch and the card, its pans just
  // clear of both; stacked, it stands over the middle of the page.
  const card = page.querySelector(".portal-login-card")?.getBoundingClientRect();
  const gapLeft = Math.max(t.right, l.right) - box.left;
  const gapRight = card ? card.left - box.left : width;
  const beside = width > 980 && gapRight - gapLeft > 200;
  const centerX = beside ? (gapLeft + gapRight) / 2 : width / 2;
  const panX = beside ? Math.max(140, (gapRight - gapLeft) / 2) : width * 0.3;
  const floorY = height * 0.88;
  const beamY = Math.max((b ? b.bottom - box.top : 0) + 36, height * 0.13);
  const ledeY = Math.min(l.bottom - box.top, floorY - 40);
  return {
    width,
    height,
    centerX,
    floorY,
    beamY,
    textBox: [t.left - box.left, k.top - box.top, Math.max(t.right, l.right) - box.left, l.bottom - box.top],
    ledeY,
    bannerY: ledeY + (floorY - ledeY) * 0.5,
    panX,
    panY: floorY - (floorY - beamY) * 0.5,
    panRadius: beside ? Math.min(150, panX * 0.42) : Math.min(200, Math.max(width * 0.075, panX * 0.36)),
    baseRadius: beside ? panX * 0.95 : Math.min(width * 0.2, 300),
    shaftRadius: beside ? panX * 0.28 : Math.min(width * 0.06, 90),
  };
}

export function ScaleBackdrop() {
  return <ComelecBackdrop active root=".portal-login" layout={place} className="pp-scale" />;
}
