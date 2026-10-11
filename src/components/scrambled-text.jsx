"use client";

// Adapted from React Bits ScrambledText, inspired by Tom Miller:
// https://codepen.io/creativeocean/pen/NPWLwJM
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import "./scrambled-text.css";

gsap.registerPlugin(SplitText, ScrambleTextPlugin);

/**
 * `settle` joins the letters up again once they've scrambled in, so styles that run across whole words (a gradient
 * clipped to the text) reach every letter. Kerning comes back with it, so use it only where that doesn't visibly
 * shift the line.
 * @param {{ children: import('react').ReactNode, as?: 'span' | 'em' | 'div',
 * duration?: number, speed?: number, scrambleChars?: string, settle?: boolean, className?: string,
 * style?: import('react').CSSProperties }} props
 */
export default function ScrambledText({
  as: Element = "div",
  duration = 1.2,
  speed = 0.5,
  scrambleChars = ".:",
  settle = false,
  className = "",
  style,
  children,
}) {
  const rootRef = useRef(null);
  const visualRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const visual = visualRef.current;
    if (!root || !visual) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let split;
    let disposed = false;
    let fontsReady = false;
    // Whether the text has scrambled in and settled since it last showed.
    let settled = false;

    function revert() {
      if (!split) return;
      gsap.killTweensOf(split.chars);
      split.revert();
      split = undefined;
    }

    function setup() {
      revert();
      if (disposed || reducedMotion.matches || !root.getClientRects().length) return;
      split = SplitText.create(visual, {
        type: "words,chars",
        wordsClass: "scrambled-text-word",
        charsClass: "scrambled-text-char",
        aria: "none",
      });
      const chars = split.chars;
      let left = chars.length;
      chars.forEach((char) => {
        // Keep glyph widths steady while dots and colons replace their contents.
        const width = char.getBoundingClientRect().width;
        gsap.set(char, { width, attr: { "data-content": char.textContent } });
        gsap.to(char, {
          duration,
          scrambleText: { text: char.dataset.content || "", chars: scrambleChars, speed },
          ease: "none",
          onComplete: () => {
            if (--left || !settle || disposed || split?.chars !== chars) return;
            settled = true;
            revert();
          },
        });
      });
    }

    // Split after fonts load so the existing type and line breaks stay stable.
    document.fonts.ready.then(() => {
      fontsReady = true;
      if (!disposed) setup();
    });
    const visibility = new ResizeObserver(() => {
      if (!root.getClientRects().length) {
        revert();
        settled = false;
      } else if (fontsReady && !split && !settled) setup();
    });
    // The landing tabs keep their panels mounted while hidden.
    visibility.observe(root.parentElement || root);
    const motionChanged = () => {
      if (reducedMotion.matches) revert();
      else document.fonts.ready.then(() => { if (!disposed) setup(); });
    };
    reducedMotion.addEventListener("change", motionChanged);
    return () => {
      disposed = true;
      reducedMotion.removeEventListener("change", motionChanged);
      visibility.disconnect();
      revert();
    };
  }, [duration, speed, scrambleChars, settle]);

  return (
    <Element ref={rootRef} className={`scrambled-text ${className}`} style={style}>
      <span className="scrambled-text-readable">{children}</span>
      <span ref={visualRef} aria-hidden="true">{children}</span>
    </Element>
  );
}
