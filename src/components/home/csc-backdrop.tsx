"use client";

import { useEffect, useRef } from "react";
import { createCouncilPodium, type CouncilPodium, type PodiumLayout, type PodiumPose } from "./council-podium";

/* The Central Student Council's scene on the Student Government landing: a grand podium under two spotlights, in a
   hall like a court's (council-podium.ts draws it). Each time the Council's banner is pointed at, the haze warms,
   the podium's light is drawn round it tier by tier from the back, the hall's columns are lit one pair after another
   from the middle out, the spots strike one after the other and swing in onto it, and the camera pushes in. */

/** The banners' artwork is 1200 × 820; their feet are on y = 690. */
const FEET = 690 / 820;

/** Where the podium goes, read off the section's own kicker, lede and banners. */
function measure(section: HTMLElement): PodiumLayout | null {
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
    centerX: s.left - box.left + s.width / 2,
    floorY: s.top - box.top + s.height * FEET,
    stage: [s.left - box.left, s.top - box.top, s.width, s.height],
    // The lede is the widest line of the heading's block, so its sides bound the words.
    textBox: [l.left - box.left - 20, k.top - box.top, l.right - box.left + 20, l.bottom - box.top],
  };
}

/** How much of the screen's resolution the scene draws at. If frames come too slowly once it has come up, it's
    lowered for the rest of the visit, a step at a time. */
let quality = 1;

/** When each spot is struck after the lights come up, in seconds. */
const STRIKES = [0.6, 0.85] as const;
/** How far out each spot starts its swing onto the podium, in radians. */
const SWING = 0.11;

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
/** A brief flare peaking at `at` seconds. */
const flare = (t: number, at: number, width: number) => Math.exp(-(((t - at) / width) ** 2));

/** A spot `t` seconds after it's struck: it stutters as the lamp catches, flares, and settles. */
function strike(t: number) {
  if (t < 0) return 0;
  const stutter = t < 0.3 ? (Math.sin(t * 95) > -0.3 ? 1 : 0.2) * (0.7 + 0.3 * Math.sin(t * 41)) : 1;
  return Math.min(1, t / 0.04) * stutter + 0.7 * flare(t, 0.38, 0.13);
}

/** The scene `since` seconds after the lights came up. */
function pose(clock: number, since: number, still: boolean): PodiumPose {
  if (still) return { time: 0, rise: 1, glow: 1, rings: [1, 1, 1], spots: [1, 1], swing: [0, 0], hall: 1 };
  return {
    time: clock,
    rise: easeOut(since / 3.2),
    glow: ease(since / 1.1),
    rings: [0, 1, 2].map((tier) => ease((since - 0.15 - tier * 0.22) / 1.35)) as PodiumPose["rings"],
    spots: STRIKES.map((at) => strike(since - at)) as PodiumPose["spots"],
    swing: STRIKES.map((at) => SWING * (1 - easeOut((since - at) / 2.6))) as PodiumPose["swing"],
    hall: Math.min(1, Math.max(0, (since - 0.2) / 1.9)),
  };
}

/** The podium behind the heading and banners. It only draws while the Council's banner is pointed at (`active`). */
export function CscBackdrop({ active }: { active: boolean }) {
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
    let scene: CouncilPodium | null = null;
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

    const draw = () => scene?.render(pose(clock, clock - litAt, motion.matches));

    const tick = (now: number) => {
      frame = 0;
      // Once the scene is up, the time between frames tells whether this screen can keep up with it.
      if (last && clock - litAt > 1.5) {
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
      // Back within a moment, it carries on; after longer, the lights come up again.
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
        scene = createCouncilPodium(canvas);
        if (!scene) {
          unavailable = true;
          return;
        }
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
    };
  }, []);

  return (
    <div className="sg-csc" aria-hidden="true">
      <div className="sg-csc-wash" />
      <canvas ref={canvasRef} className="sg-csc-scene" />
    </div>
  );
}
