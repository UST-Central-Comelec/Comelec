"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * Holds the page still while something covers it (the navbar's search and its phone menu), or lets
 * it go again. Without smooth scrolling (reduced motion), `html.is-scroll-locked` does the holding.
 */
export function lockScroll(locked: boolean) {
  document.documentElement.classList.toggle("is-scroll-locked", locked);
  window.dispatchEvent(new CustomEvent("scroll-lock", { detail: locked }));
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      syncTouch: false,
    });

    // Scrolling waits for the first-load screen, and for anything that locks it (lockScroll, above).
    let loading = Boolean(document.querySelector(".site-loader:not(.is-leaving)"));
    let locked = document.documentElement.classList.contains("is-scroll-locked");
    const sync = () => (loading || locked ? lenis.stop() : lenis.start());
    const handleLoaderDone = () => {
      loading = false;
      sync();
    };
    const handleLock = (event: Event) => {
      locked = (event as CustomEvent<boolean>).detail;
      sync();
    };
    sync();
    window.addEventListener("site-loader-done", handleLoaderDone);
    window.addEventListener("scroll-lock", handleLock);

    let frameId = 0;
    const animate = (time: number) => {
      lenis.raf(time);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("site-loader-done", handleLoaderDone);
      window.removeEventListener("scroll-lock", handleLock);
      lenis.destroy();
    };
  }, []);

  return children;
}
