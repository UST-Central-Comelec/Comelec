"use client";

import Image from "next/image";
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

  return (
    <div className={`site-loader${phase === "leaving" ? " is-leaving" : ""}`} role="status" aria-label="Loading UST Central Comelec">
      <noscript><style>{".site-loader { display: none; }"}</style></noscript>
      <div className="site-loader-mark">
        <Image src="/images/Logo-1.png" alt="" width={120} height={120} priority />
        <span>
          <strong>CENTRAL COMELEC</strong>
          <small>UST Central Commission on Elections</small>
        </span>
      </div>
    </div>
  );
}
