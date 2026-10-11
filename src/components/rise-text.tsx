"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

/**
 * Text whose words rise into place one after another from behind a clean edge, each time it mounts or its panel
 * shows again. Words are split only while they move; once they've landed the text joins up again, so a gradient
 * clipped to the whole line reaches every word. With reduced motion it simply shows.
 */
export default function RiseText({
  as: Element = "span",
  delay = 0,
  stagger = 0.07,
  duration = 1.1,
  className = "",
  style,
  children,
}: {
  as?: ElementType;
  delay?: number;
  stagger?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const visualRef = useRef<HTMLSpanElement>(null);

  // Before paint, so the words don't show for a moment before they're hidden to rise.
  useLayoutEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) rootRef.current?.setAttribute("data-rising", "");
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const visual = visualRef.current;
    if (!root || !visual) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let split: SplitText | undefined;
    let disposed = false;
    let fontsReady = false;
    // Whether the words have risen since the text last showed.
    let landed = false;

    const revert = () => {
      if (!split) return;
      gsap.killTweensOf(split.words);
      split.revert();
      split = undefined;
    };

    const rise = () => {
      revert();
      if (disposed || !root.getClientRects().length) return;
      if (reducedMotion.matches) {
        root.removeAttribute("data-rising");
        landed = true;
        return;
      }
      split = SplitText.create(visual, { type: "words", wordsClass: "rise-text-word", mask: "words", aria: "none" });
      const words = split.words;
      root.removeAttribute("data-rising");
      gsap.fromTo(words, { yPercent: 118, opacity: 0 }, {
        yPercent: 0,
        opacity: 1,
        duration,
        delay,
        stagger,
        ease: "expo.out",
        onComplete: () => {
          if (disposed || split?.words !== words) return;
          landed = true;
          revert();
        },
      });
    };

    // Split after fonts load, so the line breaks are the real ones.
    document.fonts.ready.then(() => {
      fontsReady = true;
      if (!disposed && !landed) rise();
    });
    // The landing's tabs keep their panels mounted while hidden: hidden, the words wait to rise again.
    const visibility = new ResizeObserver(() => {
      if (!root.getClientRects().length) {
        revert();
        landed = false;
        if (!reducedMotion.matches) root.setAttribute("data-rising", "");
      } else if (fontsReady && !split && !landed) rise();
    });
    visibility.observe(root.parentElement || root);
    const motionChanged = () => {
      revert();
      landed = false;
      rise();
    };
    reducedMotion.addEventListener("change", motionChanged);
    return () => {
      disposed = true;
      reducedMotion.removeEventListener("change", motionChanged);
      visibility.disconnect();
      revert();
    };
  }, [delay, stagger, duration]);

  return (
    <Element ref={rootRef} className={`rise-text ${className}`} style={style}>
      <span className="rise-text-readable">{children}</span>
      <span ref={visualRef} aria-hidden="true">{children}</span>
    </Element>
  );
}
