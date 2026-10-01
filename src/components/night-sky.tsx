"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * A night sky: small stars scattered behind the navbar's tabs (and its menu, its phone menu and the
 * home page's finale), each flickering slowly on its own rhythm, and now and then a shooting star
 * streaking across.
 * The stars' scatter is seeded rather than truly random, so the server and the browser draw the same
 * sky (no hydration mismatch) and it doesn't reshuffle between pages. Shooting stars only exist in
 * the browser, so they can be truly random.
 */
const STAR_COUNT = 72;
/** 1611, the year UST was founded: the navbar's sky. Other skies pass their own, so no two match. */
const SEED = 1611;

/** mulberry32: a tiny seeded random number generator, 0 ≤ n < 1. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatter(seed: number, count: number) {
  const random = seeded(seed);
  return Array.from({ length: count }, () => {
    // Mostly pinpricks, with the odd brighter star that gets a soft glow. The very brightest also
    // get thin flares across and up and down, like the comet's head on the home page.
    const bright = random() < 0.12;
    const size = bright ? 2 + random() * 0.8 : 1 + random() * 0.7;
    const tint = random();
    const className = [tint < 0.08 ? "is-warm" : tint < 0.26 ? "is-cool" : "", bright ? "is-bright" : "", bright && size > 2.5 ? "is-flare" : ""].filter(Boolean).join(" ");
    const x = random() * 100;
    const y = random() * 100;
    return {
      x,
      y,
      size,
      className: className || undefined,
      style: {
        left: `${x.toFixed(2)}%`,
        top: `${y.toFixed(2)}%`,
        width: `${size.toFixed(2)}px`,
        height: `${size.toFixed(2)}px`,
        // A negative delay starts each star partway through its flicker, so they never pulse in sync.
        animationDelay: `${(-random() * 16).toFixed(2)}s`,
        animationDuration: `${(7 + random() * 9).toFixed(2)}s`,
      },
    };
  });
}

type Star = ReturnType<typeof scatter>[number];

/** Each sky is scattered once and kept, so every render (server and browser) draws the same stars. */
const skies = new Map<string, Star[]>();

function skyFor(seed: number, count: number) {
  const key = `${seed}:${count}`;
  let stars = skies.get(key);
  if (!stars) skies.set(key, (stars = scatter(seed, count)));
  return stars;
}

/** Stars right beside the text keep this much of their light, and are fully back this many px away. */
const HUSH = { floor: 0.12, reach: 26 };

/** How long the sky waits between shooting stars, in ms. */
const METEOR_GAP = { min: 3500, max: 11000 };

type Meteor = { id: number; style: CSSProperties };

const between = (min: number, max: number) => min + Math.random() * (max - min);

/** A shooting star: a streak that slips across the bar at a shallow downward angle, either way. */
function makeMeteor(id: number): Meteor {
  const leftward = Math.random() < 0.5;
  const tilt = between(6, 18);
  return {
    id,
    style: {
      left: `${between(leftward ? 30 : 0, leftward ? 100 : 70).toFixed(1)}%`,
      top: `${between(-10, 45).toFixed(1)}%`,
      width: `${Math.round(between(70, 140))}px`,
      animationDuration: `${between(0.9, 1.5).toFixed(2)}s`,
      "--meteor-angle": `${(leftward ? 180 - tilt : tilt).toFixed(1)}deg`,
      "--meteor-distance": `${Math.round(between(260, 420))}px`,
    } as CSSProperties,
  };
}

type NightSkyProps = {
  /**
   * Picks the elements whose neighbouring stars fade so they don't compete with the text (in the
   * navbar: the logo and the tabs). Looked for next to the sky in its parent, or inside `within`.
   */
  dimAround?: string;
  /** The ancestor to look for `dimAround` in, when the text isn't beside the sky: a selector for `closest`. */
  within?: string;
  /** A different seed scatters a different sky. */
  seed?: number;
  /** How many stars. */
  count?: number;
  /** Whether shooting stars cross it. Off where they'd pass behind something being read. */
  meteors?: boolean;
};

export function NightSky({ dimAround, within, seed = SEED, count = STAR_COUNT, meteors: shooting = true }: NightSkyProps) {
  const skyRef = useRef<HTMLDivElement>(null);
  const stars = skyFor(seed, count);
  const [meteors, setMeteors] = useState<Meteor[]>([]);
  // How much light each star keeps, by how close it sits to that text. Measured in the browser.
  const [levels, setLevels] = useState<number[] | null>(null);

  useEffect(() => {
    const sky = skyRef.current;
    const scope = within ? sky?.closest(within) : sky?.parentElement;
    if (!sky || !scope || !dimAround) return;

    const measure = () => {
      const box = sky.getBoundingClientRect();
      // Hidden elements (the tabs, once the navbar folds into its phone menu) measure 0 × 0; skip them.
      const rects = [...scope.querySelectorAll(dimAround)].map((element) => element.getBoundingClientRect()).filter((rect) => rect.width && rect.height);
      setLevels(stars.map((star) => {
        const x = box.left + (star.x / 100) * box.width + star.size / 2;
        const y = box.top + (star.y / 100) * box.height + star.size / 2;
        const distance = Math.min(...rects.map((rect) => Math.hypot(Math.max(rect.left - x, 0, x - rect.right), Math.max(rect.top - y, 0, y - rect.bottom))));
        const t = Math.min(distance / HUSH.reach, 1);
        return Number((HUSH.floor + (1 - HUSH.floor) * t * t * (3 - 2 * t)).toFixed(2));
      }));
    };

    // Runs once on observe, then whenever the bar or the text changes size (window resize, fonts loading).
    const observer = new ResizeObserver(measure);
    observer.observe(sky);
    scope.querySelectorAll(dimAround).forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [dimAround, within, stars]);

  useEffect(() => {
    if (!shooting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let nextId = 0;
    let timer: number;
    /** Whether the sky can be seen at all: not inside a closed menu, say. */
    const showing = () => {
      const sky = skyRef.current;
      if (!sky) return false;
      return typeof sky.checkVisibility === "function" ? sky.checkVisibility({ visibilityProperty: true }) : sky.offsetParent !== null;
    };
    const schedule = () => {
      timer = window.setTimeout(() => {
        // Nothing to see in a background tab or a closed menu; skip rather than pile them up.
        if (!document.hidden && showing()) setMeteors((current) => [...current, makeMeteor(nextId++)]);
        schedule();
      }, between(METEOR_GAP.min, METEOR_GAP.max));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [shooting]);

  const land = (id: number) => setMeteors((current) => current.filter((meteor) => meteor.id !== id));

  return (
    <div ref={skyRef} className="night-sky" aria-hidden="true">
      {stars.map((star, index) => {
        const level = levels?.[index] ?? 1;
        // filter: opacity() stacks with the flicker, which animates the opacity property itself.
        return <span key={index} className={star.className} style={level < 1 ? { ...star.style, filter: `opacity(${level})` } : star.style} />;
      })}
      {meteors.map((meteor) => (
        <i key={meteor.id} className="night-sky-meteor" style={meteor.style} onAnimationEnd={() => land(meteor.id)} />
      ))}
    </div>
  );
}
