"use client";

import { useLayoutEffect } from "react";

/**
 * Home page entrances. The hero ([data-hero]) plays its entrance once the first-load screen starts
 * to leave, or straight away when the page is reached from another; anything marked [data-reveal]
 * rises into place the first time it scrolls into view. What's already on screen is left as it is,
 * and without JavaScript or with reduced motion everything simply shows.
 */
export function RevealOnScroll() {
  // Before paint, so nothing below the fold flashes up before it's hidden to wait its turn.
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hero = document.querySelector<HTMLElement>("[data-hero]");
    const ignite = () => hero?.setAttribute("data-live", "");
    if (document.querySelector(".site-loader:not(.is-leaving)")) window.addEventListener("site-loader-done", ignite, { once: true });
    else ignite();

    const fold = window.innerHeight * 0.9;
    const waiting = [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter((element) => element.getBoundingClientRect().top > fold);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.reveal = "shown";
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -12% 0px" });
    for (const element of waiting) {
      element.dataset.reveal = "waiting";
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
      window.removeEventListener("site-loader-done", ignite);
    };
  }, []);

  return null;
}
