"use client";

import { ComelecBackdrop } from "@/components/home/comelec-backdrop";
import type { ScaleLayout } from "@/components/home/justice-scale";

/* The filing portal sign-in's backdrop: the Central Comelec's justice scale from the Student Government
   landing, towering over the middle of the page with its beam over the top. */

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
  // It stands in the middle of the page at nearly the landing's span: the pans hang out over the pitch and
  // behind the card.
  const centerX = width / 2;
  const panX = width * 0.255;
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
    panRadius: Math.min(200, Math.max(width * 0.075, panX * 0.4)),
    baseRadius: Math.min(width * 0.2, 300),
    shaftRadius: Math.min(width * 0.06, 90),
  };
}

export function ScaleBackdrop() {
  return <ComelecBackdrop active root=".portal-login" layout={place} className="pp-scale" />;
}
