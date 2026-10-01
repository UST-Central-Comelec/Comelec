"use client";

import { Fragment, useEffect, useRef, type CSSProperties } from "react";

/**
 * A statement whose words light up one after another as it scrolls up the screen, all lit once its
 * last line is a little above the middle. *Starred* words are emphasised. Without JavaScript, or
 * with reduced motion, it's simply lit.
 */
export function LitStatement({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(" ");

  useEffect(() => {
    const statement = ref.current;
    if (!statement || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const box = statement.getBoundingClientRect();
      // Nothing lit while its top is below 88% of the screen; everything once its bottom reaches 40%.
      const start = window.innerHeight * 0.88;
      const end = window.innerHeight * 0.4;
      const progress = (start - box.top) / (start - end + box.height);
      statement.style.setProperty("--lit", Math.min(1, Math.max(0, progress)).toFixed(3));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    statement.dataset.lit = "";
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <p ref={ref} className={className} style={{ "--words": words.length } as CSSProperties}>
      {words.map((word, index) => (
        <Fragment key={index}>
          {index > 0 && " "}
          <span style={{ "--word": index } as CSSProperties}>{word.startsWith("*") ? <em>{word.replace(/\*/g, "")}</em> : word}</span>
        </Fragment>
      ))}
    </p>
  );
}
