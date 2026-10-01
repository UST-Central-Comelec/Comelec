"use client";

import { useCallback, useRef } from "react";

/** Where `element` sits inside `root`, going by layout alone (transforms, like an entrance, don't count). */
function offsetWithin(element: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let node: HTMLElement | null = element; node && node !== root; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y };
}

/**
 * The navbar's reticle: gold corner brackets that lock on to whatever's pointed at (a tab, a menu
 * link) and glide between them, like the one tracking the comet on the home page.
 * `field` goes on the positioned element the targets sit in, `reticle` on the brackets inside it
 * (.sh-reticle), and `lock(target)` moves them; `lock(null)` lets go. It's moved through its style
 * rather than React state, so following the pointer never re-renders the navbar.
 */
export function useReticle() {
  const fieldRef = useRef<HTMLElement | null>(null);
  const reticleRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const lock = useCallback((target: HTMLElement | null) => {
    const field = fieldRef.current;
    const reticle = reticleRef.current;
    targetRef.current = target;
    if (!field || !reticle) return;
    if (!target || !field.contains(target)) {
      reticle.classList.remove("is-locked");
      return;
    }
    const { x, y } = offsetWithin(target, field);
    // Appearing lands it in place; only a reticle that's already out glides over.
    const appearing = !reticle.classList.contains("is-locked");
    if (appearing) reticle.style.transition = "none";
    reticle.style.width = `${target.offsetWidth}px`;
    reticle.style.height = `${target.offsetHeight}px`;
    reticle.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (appearing) {
      // Reading a layout value applies the jump before the transition is handed back.
      void reticle.offsetWidth;
      reticle.style.transition = "";
      reticle.classList.add("is-locked");
    }
  }, []);

  /** Keeps the brackets on their target when the field changes size (a window resize, fonts loading). */
  const field = useCallback((node: HTMLElement | null) => {
    fieldRef.current = node;
    if (!node) return;
    const observer = new ResizeObserver(() => lock(targetRef.current));
    observer.observe(node);
    return () => {
      observer.disconnect();
      fieldRef.current = null;
    };
  }, [lock]);

  return { field, reticle: reticleRef, lock };
}
