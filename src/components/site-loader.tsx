"use client";

import { ComelecLoadingScreen } from "./comelec-loading-screen";
import { useEffect, useState } from "react";

const MIN_DISPLAY_MS = 2600;
const FADE_MS = 700;

export function SiteLoader() {
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minDelay = new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 600 : MIN_DISPLAY_MS));
    const pageLoaded = new Promise((resolve) => {
      if (document.readyState === "complete") resolve(null);
      else window.addEventListener("load", resolve, { once: true });
    });

    let fadeTimer = 0;
    let cancelled = false;

    Promise.all([minDelay, pageLoaded]).then(() => {
      if (cancelled) return;
      setPhase("leaving");
      window.dispatchEvent(new Event("site-loader-done"));
      fadeTimer = window.setTimeout(() => setPhase("done"), FADE_MS);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fadeTimer);
    };
  }, []);

  if (phase === "done") return null;

  return <ComelecLoadingScreen leaving={phase === "leaving"} />;
}
