"use client";

import { useEffect, useRef } from "react";
import { createJusticeScale, type JusticeScale, type ScaleLayout, type ScalePose, type ScaleRig } from "./justice-scale";

/* The Central Comelec's scene on the Student Government landing: a colossal justice scale seen from the floor,
   towering over the banners with a blinding light behind its beam (justice-scale.ts draws it). Each time the
   Comelec banner is pointed at, the fog glows up from below, the light breaks over the top in a flare and
   pours down in shafts, the camera cranes up as the scale rises into place, and the beam, still tipped, swings
   slowly back to level. */

/** The banners' artwork is 1200 × 820: their feet are on y = 690, the outer banners' tops on y = 157 and the
    middle banner's top on y = 270. */
const FEET = 690 / 820;
const OUTER_TOP = 157.27 / 820;
const BANNER_TOP = 270.15 / 820;

/** Where the scale goes, read off the section's own kicker, heading, lede and banners. */
function measure(section: HTMLElement): ScaleLayout | null {
  const kicker = section.querySelector(".sg-kicker");
  const heading = section.querySelector(".sg-intro h1");
  const lede = section.querySelector(".sg-lede");
  const stage = section.querySelector(".sg-stage");
  const box = section.getBoundingClientRect();
  if (!heading || !lede || !stage || !box.width || !box.height) return null;
  const h = heading.getBoundingClientRect(), l = lede.getBoundingClientRect(), s = stage.getBoundingClientRect();
  const k = kicker?.getBoundingClientRect() ?? h;
  const centerX = s.left - box.left + s.width / 2;
  const floorY = s.top - box.top + s.height * FEET;
  // The pans hang big in the room beside the outer banners, about half way down them.
  const room = centerX - s.width * 0.4;
  const outerTop = s.top - box.top + s.height * OUTER_TOP;
  return {
    width: box.width,
    height: box.height,
    centerX,
    floorY,
    // The beam crosses where the kicker sits, between the navbar and the heading.
    beamY: (k.top + k.bottom) / 2 - box.top,
    textBox: [h.left - box.left + h.width * 0.06, k.top - box.top, h.right - box.left - h.width * 0.06, l.bottom - box.top],
    ledeY: l.bottom - box.top,
    bannerY: s.top - box.top + s.height * BANNER_TOP,
    panX: s.width * 0.4 + room / 2,
    panY: floorY - (floorY - outerTop) * 0.48,
    panRadius: Math.min(200, Math.max(box.width * 0.075, room * 0.46)),
    baseRadius: s.width * 0.27,
    shaftRadius: s.width * 0.085,
  };
}

/** The beam's spring and damping: a colossus swings slowly, about once every four and a half seconds, overshoots
    once and settles heavily. */
const STIFFNESS = 2;
const DAMPING = 0.7;
/** The pans swing on their long chains once every five seconds or so. */
const SWING = (2 * Math.PI) / 5;
const SWING_DAMPING = 0.4;
/** How far the beam leans as it keeps weighing (radians), and how fast it goes from one side to the other. */
const WEIGH = 0.04;
const WEIGH_RATE = (2 * Math.PI) / 16;

const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
/** A brief flare peaking at `at` seconds. */
const flare = (t: number, at: number, width: number) => Math.exp(-(((t - at) / width) ** 2));

/** The scale behind the heading and banners. It only draws while the Comelec banner is pointed at (`active`).
    Elsewhere (the filing portal's sign-in) it takes the page it sits in (`root`, a selector for an ancestor), how
    to place the scale in it (`layout`), and its own class. */
export function ComelecBackdrop({ active, root = ".sg-landing", layout = measure, className = "sg-cc" }: { active: boolean; root?: string; layout?: (section: HTMLElement) => ScaleLayout | null; className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const syncRef = useRef<() => void>(() => {});
  useEffect(() => {
    activeRef.current = active;
    syncRef.current();
  }, [active]);

  useEffect(() => {
    const holder = frameRef.current;
    const section = holder?.closest<HTMLElement>(root);
    if (!holder || !section) return;
    // A canvas of its own each time: disposing the scene loses its canvas's context for good, and a remount
    // (React's development double run included) would otherwise find it dead.
    const canvas = document.createElement("canvas");
    canvas.className = `${className}-scene`;
    holder.append(canvas);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scene: JusticeScale | null = null;
    let unavailable = false, lost = false, onScreen = true, shown = false;
    let rig: ScaleRig | null = null;
    let fitted = "";
    // When the banner was last left (in page time), and when the drawing stops after that.
    let frame = 0, last = 0, leftAt = -Infinity, stopAt = 0;
    // The balance: the beam's tilt and each pan's swing from plumb, with how fast each is moving. The clock only
    // runs while the scene is drawn.
    const balance = { beam: 0, beamRate: 0, left: 0, leftRate: 0, right: 0, rightRate: 0 };
    let clock = 0, litAt = -10, side = 1;

    /** Measures the section and rebuilds the scene if anything moved. */
    const fit = () => {
      const next = layout(section);
      if (!next || !scene) return false;
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3.2e6 / (next.width * next.height)));
      const key = [...Object.values(next).flat().map(Math.round), ratio.toFixed(2)].join();
      if (key !== fitted) {
        fitted = key;
        rig = scene.resize(next, ratio);
      }
      return true;
    };

    /** Sets the scale swinging: tipped one way, then the other, each time the lights come up. */
    const weigh = () => {
      side = -side;
      Object.assign(balance, { beam: side * 0.075, beamRate: 0, left: -side * 0.03, leftRate: 0, right: side * 0.02, rightRate: 0 });
      litAt = clock;
    };

    const settle = (dt: number) => {
      if (!rig) return;
      // It never stops weighing: the beam leans slowly to one side, holds, then is drawn back over to the other,
      // about every sixteen seconds, with a slight unevenness so no two passes are quite the same.
      const rest = WEIGH * Math.tanh(2.2 * Math.sin(clock * WEIGH_RATE)) + WEIGH * 0.25 * Math.sin(clock * 0.6 + 1.3);
      const pull = -STIFFNESS * (balance.beam - rest) - DAMPING * balance.beamRate;
      balance.beamRate += pull * dt;
      balance.beam += balance.beamRate * dt;
      // Each pan is a pendulum on a hook that the beam carries round the pivot.
      const gravity = rig.reach * SWING * SWING;
      const c = Math.cos(balance.beam), s = Math.sin(balance.beam), spin = balance.beamRate ** 2;
      for (const [hand, sign] of [["left", -1], ["right", 1]] as const) {
        const x = c * sign * rig.arm, y = s * sign * rig.arm;
        const ax = -pull * y - spin * x, ay = pull * x - spin * y;
        const angle = balance[hand];
        const rateKey = hand === "left" ? "leftRate" : "rightRate";
        const swing = -(gravity * Math.sin(angle) + ay * Math.sin(angle) + ax * Math.cos(angle)) / rig.reach - SWING_DAMPING * balance[rateKey];
        balance[rateKey] += swing * dt;
        balance[hand] += balance[rateKey] * dt;
      }
    };

    const draw = () => {
      if (!scene || !rig) return;
      const since = clock - litAt;
      const pose: ScalePose = motion.matches
        ? { time: 0, beam: 0, left: 0, right: 0, turn: 0, rise: 1, glow: 1, light: 1, shafts: 1 }
        : {
            time: clock,
            beam: balance.beam,
            left: balance.left,
            right: balance.right,
            turn: Math.sin(clock * 0.17) * 0.02,
            rise: easeOut(since / 3),
            // The fog glows up first; then the light above breaks in a flare and settles, pouring its shafts down.
            glow: ease(since / 1.1),
            light: ease((since - 0.3) / 0.7) + 0.6 * flare(since, 0.95, 0.24),
            shafts: ease((since - 0.35) / 1.2) + 0.5 * flare(since, 1.05, 0.32),
          };
      scene.render(pose);
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      clock += dt;
      for (let left = dt; left > 0; left -= 1 / 240) settle(Math.min(left, 1 / 240));
      draw();
      // Keeps going through the fade-out after the banner is left, then rests.
      if ((activeRef.current || now < stopAt) && onScreen && !document.hidden && !lost && !motion.matches) frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      const live = activeRef.current && onScreen && !document.hidden;
      // Back within a moment, it carries on; after longer, the lights come up and it weighs again.
      if (activeRef.current && !shown) {
        shown = true;
        if (performance.now() - leftAt > 1200) weigh();
      } else if (!activeRef.current && shown) {
        shown = false;
        leftAt = performance.now();
        stopAt = leftAt + 900;
      }
      if (!live || unavailable || lost) return;
      if (!scene) {
        scene = createJusticeScale(canvas);
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
      canvas.remove();
    };
  }, [root, layout, className]);

  return (
    <div ref={frameRef} className={className} aria-hidden="true">
      <div className={`${className}-wash`} />
    </div>
  );
}
