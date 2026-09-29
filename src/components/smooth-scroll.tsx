"use client";

import Lenis from "lenis";
import { useEffect } from "react";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (reducedMotion.matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      syncTouch: false,
    });

    const handleLenisScroll = ({ scroll }: { scroll: number }) => {
      window.dispatchEvent(new CustomEvent("smooth-scroll", { detail: scroll }));
    };

    lenis.on("scroll", handleLenisScroll);

    const startLenis = () => lenis.start();
    if (document.querySelector(".site-loader:not(.is-leaving)")) lenis.stop();
    window.addEventListener("site-loader-done", startLenis);

    let frameId = 0;
    const animate = (time: number) => {
      lenis.raf(time);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      lenis.off("scroll", handleLenisScroll);
      window.removeEventListener("site-loader-done", startLenis);
      lenis.destroy();
    };
  }, []);

  return children;
}
