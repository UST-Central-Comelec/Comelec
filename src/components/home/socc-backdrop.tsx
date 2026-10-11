"use client";

import { useEffect, useRef } from "react";
import { createRedMoon, type MoonLayout, type MoonPose, type RedMoon } from "./red-moon";

/* The Student Organizations Coordinating Council's scene on the Student Government landing: a colossal red moon over
   a plain of black glass, its edge the arc the banners' tops are cut from, with a star breaking out from behind it
   beside the Council's banner (red-moon.ts draws it). Each time the Council's banner is pointed at, the night comes
   up, light runs round the moon's edge from the star both ways, along the banners' tops, the star breaks the edge
   in a burst, and the camera settles. Once the scene is running, the flat moon and nebula in the page stand down
   (`data-live` on the canvas); they're what shows where WebGL can't run. */

/** Where everything goes, read off the section's own kicker, lede and banners. */
function measure(section: HTMLElement): MoonLayout | null {
  const kicker = section.querySelector(".sg-kicker");
  const lede = section.querySelector(".sg-lede");
  const stage = section.querySelector(".sg-stage");
  const box = section.getBoundingClientRect();
  if (!lede || !stage || !box.width || !box.height) return null;
  const l = lede.getBoundingClientRect(), s = stage.getBoundingClientRect();
  const k = kicker?.getBoundingClientRect() ?? l;
  return {
    width: box.width,
    height: box.height,
    stage: [s.left - box.left, s.top - box.top, s.width, s.height],
    // The lede is the widest line of the heading's block, so its sides bound the words.
    textBox: [l.left - box.left - 20, k.top - box.top, l.right - box.left + 20, l.bottom - box.top],
  };
}

/** How much of the screen's resolution the scene draws at. If frames come too slowly once it has come up, it's
    lowered for the rest of the visit, a step at a time. */
let quality = 1;

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
/** A brief flare peaking at `at` seconds. */
const flare = (t: number, at: number, width: number) => Math.exp(-(((t - at) / width) ** 2));

/** When the star breaks the edge, in seconds after the night comes up. */
const BREAK = 1.15;

/** The scene `since` seconds after the night came up. */
function pose(clock: number, since: number, still: boolean): MoonPose {
  if (still) return { time: 0, rise: 1, glow: 1, ring: 1, sun: 1, flare: 0 };
  return {
    time: clock,
    rise: easeOut(since / 3.4),
    glow: ease(since / 1.2),
    ring: ease((since - 0.15) / 1.7),
    sun: ease((since - BREAK + 0.25) / 0.6) + 0.35 * flare(since, BREAK + 0.1, 0.25),
    flare: flare(since, BREAK + 0.08, 0.2),
  };
}

/** The moon behind the heading and banners. It only draws while the Council's banner is pointed at (`active`). */
export function SoccBackdrop({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const syncRef = useRef<() => void>(() => {});
  useEffect(() => {
    activeRef.current = active;
    syncRef.current();
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest<HTMLElement>(".sg-landing");
    if (!canvas || !section) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scene: RedMoon | null = null;
    let unavailable = false, lost = false, onScreen = true, shown = false;
    let fitted = "";
    // When the banner was last left (in page time), and when the drawing stops after that. The clock only runs
    // while the scene is drawn.
    let frame = 0, last = 0, leftAt = -Infinity, stopAt = 0;
    let clock = 0, litAt = -10;
    const gaps: number[] = [];

    /** Measures the section and rebuilds the scene if anything moved. */
    const fit = () => {
      const next = measure(section);
      if (!next || !scene) return false;
      const ratio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3.2e6 / (next.width * next.height))) * quality);
      const key = [...Object.values(next).flat().map(Math.round), ratio.toFixed(2)].join();
      if (key !== fitted) {
        fitted = key;
        scene.resize(next, ratio);
      }
      return true;
    };

    // With reduced motion there's one still frame, so the moon's surface is baked whole for it.
    const draw = () => scene?.render(pose(clock, clock - litAt, motion.matches), motion.matches ? 6 : 1);

    const tick = (now: number) => {
      frame = 0;
      // Once the scene is up, the time between frames tells whether this screen can keep up with it.
      if (last && clock - litAt > 1.8) {
        gaps.push(now - last);
        if (gaps.length > 45) gaps.shift();
        if (gaps.length === 45 && quality > 0.55 && [...gaps].sort((a, b) => a - b)[22] > 24) {
          quality *= 0.75;
          gaps.length = 0;
          fit();
        }
      }
      clock += last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      draw();
      // Keeps going through the fade-out after the banner is left, then rests.
      if ((activeRef.current || now < stopAt) && onScreen && !document.hidden && !lost && !motion.matches) frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      const live = activeRef.current && onScreen && !document.hidden;
      // Back within a moment, it carries on; after longer, the night comes up again.
      if (activeRef.current && !shown) {
        shown = true;
        if (performance.now() - leftAt > 1200) litAt = clock;
      } else if (!activeRef.current && shown) {
        shown = false;
        leftAt = performance.now();
        stopAt = leftAt + 900;
      }
      if (!live || unavailable || lost) return;
      if (!scene) {
        scene = createRedMoon(canvas);
        if (!scene) {
          unavailable = true;
          return;
        }
        canvas.dataset.live = "";
      }
      if (!fit()) return;
      if (motion.matches) {
        draw();
        return;
      }
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    syncRef.current = sync;

    const resize = new ResizeObserver(() => {
      if (!scene || !fit()) return;
      if (activeRef.current) draw();
    });
    resize.observe(section);
    const visible = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    visible.observe(section);
    const handleLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const handleRestored = () => {
      lost = false;
      scene = null;
      fitted = "";
      sync();
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    canvas.addEventListener("webglcontextrestored", handleRestored);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    sync();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      syncRef.current = () => {};
      resize.disconnect();
      visible.disconnect();
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      scene?.dispose();
      delete canvas.dataset.live;
    };
  }, []);

  return (
    <div className="sg-socc" aria-hidden="true">
      <canvas ref={canvasRef} className="sg-socc-scene" />
    </div>
  );
}
