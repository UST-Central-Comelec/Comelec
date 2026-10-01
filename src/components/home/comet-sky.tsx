"use client";

import { useEffect, useRef } from "react";

/**
 * The home page hero's sky, drawn on a canvas: stars drifting past at three depths, the odd shooting
 * star, and the COMET itself, a glowing head trailing a gold dust tail that curls as it spreads and a
 * straight, cool ion tail. The head rests just past the end of the wordmark (`anchor`), drifts a
 * little and leans toward the pointer. A tracking reticle follows it, the wordmark's letters catch
 * its light (--lx/--ly on the wordmark), and scrolling away lifts the hero's copy (--hero-scroll and
 * --hero-lift on the hero).
 * It only draws while the hero is on screen and the tab is in front; with reduced motion it draws a
 * single still frame.
 */

type Point = { x: number; y: number };
type Star = { x: number; y: number; depth: number; size: number; light: number; rate: number; phase: number; tone: number; glow: boolean };
/** A speck of the dust tail: a spark, or a wide faint wisp of haze (`haze`) that gives the tail its body. */
type Grain = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; tone: number; haze: boolean };
type Streak = { x: number; y: number; vx: number; vy: number; age: number; life: number; length: number };
type Sprites = ReturnType<typeof makeSprites>;

/** White, cool and warm: the same stars as the navbar's night sky. */
const TONES = ["#ffffff", "#d4e0ff", "#ffe6a8"];

/** Stars per px² at each depth: many faint and far, a few bright and near. Nearer ones drift faster. */
const LAYERS = [
  { depth: 0.25, density: 1 / 2600, size: [0.5, 1], light: [0.2, 0.55] },
  { depth: 0.55, density: 1 / 9000, size: [0.9, 1.5], light: [0.35, 0.8] },
  { depth: 1, density: 1 / 46000, size: [1.3, 2.2], light: [0.6, 1] },
] as const;

/** Fine streaks inside the ion tail: how far off its line each runs, how far it reaches, and its shimmer. */
const FILAMENTS = [
  { spread: -0.046, reach: 0.42, rate: 0.7, phase: 0 },
  { spread: -0.024, reach: 0.8, rate: 0.5, phase: 1.3 },
  { spread: -0.008, reach: 1, rate: 0.9, phase: 2.1 },
  { spread: 0.007, reach: 0.66, rate: 0.6, phase: 3.4 },
  { spread: 0.021, reach: 0.9, rate: 1.1, phase: 4.2 },
  { spread: 0.036, reach: 0.52, rate: 0.8, phase: 5.1 },
  { spread: 0.054, reach: 0.34, rate: 1.3, phase: 0.6 },
];

/** How far, in px, scrolling past the hero lifts its copy. */
const LIFT = 90;

const between = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (value: number, min = -1, max = 1) => Math.min(max, Math.max(min, value));
const radians = (degrees: number) => (degrees * Math.PI) / 180;
/** Eases a value toward its target at `rate`, however long the frame took. */
const approach = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

/** A soft round glow, drawn once and stamped wherever a grain, star or the head needs one. */
function glow(stops: Array<[number, string]>, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function makeSprites() {
  return {
    gold: glow([[0, "rgba(255,247,222,1)"], [0.16, "rgba(255,216,110,.85)"], [0.42, "rgba(254,195,12,.26)"], [1, "rgba(254,195,12,0)"]]),
    warm: glow([[0, "rgba(255,255,250,1)"], [0.3, "rgba(255,236,190,.55)"], [1, "rgba(255,236,190,0)"]]),
    ice: glow([[0, "rgba(244,248,255,1)"], [0.28, "rgba(190,212,255,.5)"], [1, "rgba(190,212,255,0)"]]),
    stars: TONES.map((tone) => glow([[0, tone], [0.25, `${tone}88`], [1, `${tone}00`]], 32)),
  };
}

function scatterStars(width: number, height: number) {
  const stars: Star[] = [];
  for (const layer of LAYERS) {
    const count = Math.round(width * height * layer.density);
    for (let index = 0; index < count; index += 1) {
      const roll = Math.random();
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        depth: layer.depth,
        size: between(layer.size[0], layer.size[1]),
        light: between(layer.light[0], layer.light[1]),
        rate: between(0.4, 1.8),
        phase: Math.random() * Math.PI * 2,
        tone: roll < 0.08 ? 2 : roll < 0.26 ? 1 : 0,
        glow: layer.depth === 1,
      });
    }
  }
  // Grouped by tone, so a frame only switches fill colour a few times.
  return stars.sort((a, b) => Number(a.glow) - Number(b.glow) || a.tone - b.tone);
}

/** The scene, in CSS pixels. */
class Sky {
  ctx: CanvasRenderingContext2D;
  sprites: Sprites;
  width = 0;
  height = 0;
  stars: Star[] = [];
  grains: Grain[] = [];
  streaks: Streak[] = [];
  /** Where the head rests, beside the wordmark, and where it is now. */
  rest: Point = { x: 0, y: 0 };
  head: Point | null = null;
  /** The pointer over the hero, -1 to 1 each way, and where it's easing toward. */
  lean: Point = { x: 0, y: 0 };
  leanTarget: Point = { x: 0, y: 0 };
  /** The tails stream up and to the right, away from where the comet is heading. */
  ionAngle = radians(-31);
  ion: Point = { x: 0, y: 0 };
  dust: Point = { x: 0, y: 0 };
  /** Square to the dust tail, pointing down and to the right: the way its grains curl. */
  curl: Point = { x: 0, y: 0 };
  /** Grains shed per second. */
  emission = 150;
  time = 0;
  carry = 0;
  nextStreak = 3;

  constructor(ctx: CanvasRenderingContext2D, sprites: Sprites) {
    this.ctx = ctx;
    this.sprites = sprites;
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.stars = scatterStars(width, height);
    this.emission = width < 700 ? 120 : 210;
  }

  /** Moves the head's resting spot; the head itself glides over. `tilt` is the tails' angle, in degrees. */
  settle(rest: Point, tilt: number) {
    this.rest = rest;
    this.head ??= { ...rest };
    this.ionAngle = radians(tilt);
    this.ion = { x: Math.cos(this.ionAngle), y: Math.sin(this.ionAngle) };
    // The dust tail sets off a little flatter than the ion tail, then curls further away from it.
    this.dust = { x: Math.cos(this.ionAngle + radians(4)), y: Math.sin(this.ionAngle + radians(4)) };
    this.curl = { x: -this.dust.y, y: this.dust.x };
  }

  step(dt: number) {
    const head = this.head;
    if (!head) return;
    this.time += dt;
    const t = this.time;

    this.lean.x = approach(this.lean.x, this.leanTarget.x, 2.2, dt);
    this.lean.y = approach(this.lean.y, this.leanTarget.y, 2.2, dt);
    head.x = approach(head.x, this.rest.x + Math.sin(t * 0.31) * 9 + Math.sin(t * 0.83) * 3 + this.lean.x * 22, 3, dt);
    head.y = approach(head.y, this.rest.y + Math.sin(t * 0.47 + 1) * 6 + this.lean.y * 14, 3, dt);

    // Stars drift the way the tails point, nearer ones faster: the comet is flying the other way.
    for (const star of this.stars) {
      star.x += this.ion.x * star.depth * 9 * dt;
      star.y += this.ion.y * star.depth * 9 * dt;
      if (star.x > this.width + 4) star.x -= this.width + 8;
      else if (star.x < -4) star.x += this.width + 8;
      if (star.y < -4) star.y += this.height + 8;
      else if (star.y > this.height + 4) star.y -= this.height + 8;
    }

    // Grains leave the head all the time and stream back along the tail, curling as they go. Most
    // are sparks, mostly slow; about one in eight is haze.
    this.carry += dt * this.emission;
    while (this.carry >= 1) {
      this.carry -= 1;
      const haze = Math.random() < 0.12;
      const speed = haze ? between(18, 110) : 26 + Math.random() ** 1.7 * 170;
      const spread = (Math.random() - 0.5) * (haze ? 44 : 30);
      const roll = Math.random();
      this.grains.push({
        x: head.x + (Math.random() - 0.5) * 5,
        y: head.y + (Math.random() - 0.5) * 5,
        vx: this.dust.x * speed + this.curl.x * spread,
        vy: this.dust.y * speed + this.curl.y * spread,
        age: 0,
        life: haze ? between(3, 6) : between(1.6, 4.6),
        size: haze ? between(9, 24) : between(0.7, 2.3),
        tone: haze ? (roll < 0.25 ? 1 : 0) : roll < 0.1 ? 2 : roll < 0.32 ? 1 : 0,
        haze,
      });
    }
    let kept = 0;
    for (const grain of this.grains) {
      grain.age += dt;
      if (grain.age >= grain.life) continue;
      grain.vx += this.curl.x * 11 * dt;
      grain.vy += this.curl.y * 11 * dt;
      grain.x += grain.vx * dt;
      grain.y += grain.vy * dt;
      this.grains[kept++] = grain;
    }
    this.grains.length = kept;

    // Now and then, a shooting star somewhere up high.
    this.nextStreak -= dt;
    if (this.nextStreak <= 0) {
      this.nextStreak = between(4, 11);
      const leftward = Math.random() < 0.5;
      const angle = radians(leftward ? 180 - between(12, 28) : between(12, 28));
      const speed = between(620, 1000);
      this.streaks.push({ x: this.width * between(0.08, 0.92), y: this.height * between(0, 0.45), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: between(0.6, 1.1), length: between(70, 160) });
    }
    this.streaks = this.streaks.filter((streak) => {
      streak.age += dt;
      streak.x += streak.vx * dt;
      streak.y += streak.vy * dt;
      return streak.age < streak.life;
    });
  }

  draw() {
    const { ctx, head, sprites, width, height, time: t } = this;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    if (!head) return;
    // Light adds up: where grains overlap, the tail burns brighter.
    ctx.globalCompositeOperation = "lighter";

    // Stars, shifted against the pointer by their depth.
    const shiftX = -this.lean.x * 16;
    const shiftY = -this.lean.y * 11;
    let tone = -1;
    for (const star of this.stars) {
      const x = star.x + shiftX * star.depth;
      const y = star.y + shiftY * star.depth;
      ctx.globalAlpha = star.light * (0.68 + 0.32 * Math.sin(t * star.rate + star.phase));
      if (star.glow) {
        const size = star.size * 5;
        ctx.drawImage(sprites.stars[star.tone], x - size / 2, y - size / 2, size, size);
        continue;
      }
      if (star.tone !== tone) {
        tone = star.tone;
        ctx.fillStyle = TONES[tone];
      }
      ctx.fillRect(x, y, star.size, star.size);
    }

    ctx.lineCap = "round";
    ctx.lineWidth = 1.2;
    for (const streak of this.streaks) {
      const speed = Math.hypot(streak.vx, streak.vy);
      const tailX = streak.x - (streak.vx / speed) * streak.length;
      const tailY = streak.y - (streak.vy / speed) * streak.length;
      const trail = ctx.createLinearGradient(tailX, tailY, streak.x, streak.y);
      trail.addColorStop(0, "rgba(235,240,255,0)");
      trail.addColorStop(1, "rgba(235,240,255,.9)");
      const alpha = Math.sin(Math.PI * (streak.age / streak.life));
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = trail;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(streak.x, streak.y);
      ctx.stroke();
      this.stamp(sprites.warm, streak.x, streak.y, 8, alpha);
    }

    this.drawIonTail(head);
    for (const grain of this.grains) {
      // Each grain fades in fast, then out as it spreads.
      const k = grain.age / grain.life;
      const fade = Math.min(1, grain.age / 0.12) * (1 - k) ** 1.6;
      const sprite = grain.tone === 0 ? sprites.gold : grain.tone === 1 ? sprites.warm : sprites.ice;
      if (grain.haze) this.stamp(sprite, grain.x, grain.y, grain.size * (1 + 1.8 * k), fade * 0.11);
      else this.stamp(sprite, grain.x, grain.y, grain.size * (3 + 6 * k), fade * 0.75);
    }

    // The head: a wide halo, the coma, a white-hot core, and thin flares across and up and down
    // it, like starlight caught in a telescope's optics.
    const breath = 1 + Math.sin(t * 1.6) * 0.05;
    this.stamp(sprites.gold, head.x, head.y, 340 * breath, 0.16);
    this.stamp(sprites.gold, head.x, head.y, 130 * breath, 0.5);
    this.stamp(sprites.warm, head.x, head.y, 46, 0.95);
    this.stamp(sprites.warm, head.x, head.y, 16, 1);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.globalAlpha = 0.3 + Math.sin(t * 1.1) * 0.05;
    ctx.scale(1, 0.014);
    ctx.drawImage(sprites.ice, -280, -280, 560, 560);
    ctx.restore();
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.globalAlpha = 0.16;
    ctx.scale(0.012, 1);
    ctx.drawImage(sprites.ice, -90, -90, 180, 180);
    ctx.restore();
  }

  drawIonTail(head: Point) {
    const { ctx, ion, time: t } = this;
    const length = Math.hypot(this.width, this.height) * 0.8;
    const across = { x: -ion.y, y: ion.x };
    const end = { x: head.x + ion.x * length, y: head.y + ion.y * length };
    const sheet = ctx.createLinearGradient(head.x, head.y, end.x, end.y);
    sheet.addColorStop(0, "rgba(206,224,255,.24)");
    sheet.addColorStop(0.2, "rgba(170,196,255,.09)");
    sheet.addColorStop(1, "rgba(150,180,255,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = sheet;
    ctx.beginPath();
    ctx.moveTo(head.x + across.x * 2, head.y + across.y * 2);
    ctx.lineTo(end.x + across.x * 40, end.y + across.y * 40);
    ctx.lineTo(end.x - across.x * 40, end.y - across.y * 40);
    ctx.lineTo(head.x - across.x * 2, head.y - across.y * 2);
    ctx.closePath();
    ctx.fill();

    ctx.lineWidth = 1;
    for (const filament of FILAMENTS) {
      const angle = this.ionAngle + filament.spread;
      const x = head.x + Math.cos(angle) * length * filament.reach;
      const y = head.y + Math.sin(angle) * length * filament.reach;
      const shimmer = 0.06 + 0.12 * (0.5 + 0.5 * Math.sin(t * filament.rate + filament.phase));
      const line = ctx.createLinearGradient(head.x, head.y, x, y);
      line.addColorStop(0, `rgba(222,234,255,${shimmer.toFixed(3)})`);
      line.addColorStop(1, "rgba(222,234,255,0)");
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.moveTo(head.x, head.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  stamp(sprite: HTMLCanvasElement, x: number, y: number, size: number, alpha: number) {
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
  }
}

/** Where `element` sits inside `root`, going by layout alone (transforms, like the entrance, don't count). */
function offsetWithin(element: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let node: HTMLElement | null = element; node && node !== root; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y, width: element.offsetWidth, height: element.offsetHeight };
}

/** The reticle's readout: a steady made-up sky position that shifts as the head does. RA 16h 11m, for 1611, the year UST was founded. */
function readoutFor(sky: Sky) {
  const head = sky.head ?? sky.rest;
  const seconds = (((42.6 + (head.x - sky.rest.x) * 0.9) % 60) + 60) % 60;
  const minutes = (((36 - (head.y - sky.rest.y) * 0.7) % 60) + 60) % 60;
  return `RA 16h 11m ${seconds.toFixed(1).padStart(4, "0")}s · DEC +14° ${String(Math.floor(minutes)).padStart(2, "0")}′`;
}

export function CometSky({ anchor }: { anchor: string }) {
  const skyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = skyRef.current;
    const canvas = canvasRef.current;
    const reticle = reticleRef.current;
    const readout = readoutRef.current;
    const hero = host?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!host || !canvas || !reticle || !readout || !hero || !ctx) return;

    const wordmark = hero.querySelector<HTMLElement>(anchor);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sky = new Sky(ctx, makeSprites());
    let word = { x: 0, y: 0 };
    // The hero's box on the page, so following the pointer never has to measure mid-frame.
    let bounds = { left: 0, top: 0, width: 1, height: 1 };
    let aim: Point | null = null;
    let lastScroll = -1;
    let readoutIn = 0;

    /** Sizes the canvas to the hero, sharp on high-density screens but never more than ~6 megapixels. */
    const fit = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return false;
      const box = host.getBoundingClientRect();
      bounds = { left: box.left + window.scrollX, top: box.top + window.scrollY, width, height };
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6e6 / (width * height)));
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      sky.resize(width, height);
      // Beside the wordmark's last letter on wide screens; on phones, where it fills the width, just
      // off its end with the tails swept up more steeply, so they still show.
      const mark = wordmark ? offsetWithin(wordmark, hero) : null;
      if (mark) word = mark;
      if (!mark) sky.settle({ x: width * 0.72, y: height * 0.34 }, -31);
      else if (width < 700) sky.settle({ x: Math.min(mark.x + mark.width + 22, width - 26), y: mark.y + mark.height * 0.26 }, -56);
      else sky.settle({ x: Math.min(mark.x + mark.width + width * 0.07, width - 140), y: mark.y + mark.height * 0.2 }, width < 1000 ? -42 : -31);
      return true;
    };

    /** Everything that follows the head: the reticle, its readout, the wordmark's light, and the scroll lift. */
    const follow = (dt: number) => {
      const head = sky.head;
      if (!head) return;
      aim = aim ? { x: approach(aim.x, head.x, 6, dt), y: approach(aim.y, head.y, 6, dt) } : { ...head };
      reticle.style.transform = `translate3d(${aim.x.toFixed(1)}px, ${aim.y.toFixed(1)}px, 0)`;
      readoutIn -= dt;
      if (readoutIn <= 0) {
        readoutIn = 0.12;
        readout.textContent = readoutFor(sky);
      }
      const scroll = still ? 0 : clamp(window.scrollY / (sky.height * 0.8), 0, 1);
      if (scroll !== lastScroll) {
        lastScroll = scroll;
        hero.style.setProperty("--hero-scroll", scroll.toFixed(3));
        hero.style.setProperty("--hero-lift", `${(scroll * LIFT).toFixed(1)}px`);
      }
      wordmark?.style.setProperty("--lx", `${(head.x - word.x).toFixed(1)}px`);
      wordmark?.style.setProperty("--ly", `${(head.y - word.y - scroll * LIFT).toFixed(1)}px`);
    };

    /** Runs the scene on ahead, so the tail is already streaming when it first shows. */
    const warmUp = (seconds: number) => {
      for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 30) sky.step(1 / 30);
    };

    const paintStill = () => {
      if (!fit()) return;
      sky.grains = [];
      sky.head = { ...sky.rest };
      warmUp(3);
      sky.draw();
      aim = null;
      follow(0);
    };

    let frame = 0;
    let last = 0;
    let running = false;
    let onScreen = true;
    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      sky.step(dt);
      sky.draw();
      follow(dt);
      frame = requestAnimationFrame(render);
    };
    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(render);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };
    const sync = () => (onScreen && !document.hidden ? start() : stop());

    const lean = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      sky.leanTarget = { x: clamp(((event.pageX - bounds.left) / bounds.width) * 2 - 1), y: clamp(((event.pageY - bounds.top) / bounds.height) * 2 - 1) };
    };

    // Refit when the hero or the wordmark changes size (window resizes, fonts loading, the entrance).
    const resizer = new ResizeObserver(() => (still ? paintStill() : fit()));
    const watcher = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });

    if (still) paintStill();
    else if (fit()) {
      warmUp(2.4);
      follow(0);
    }
    reticle.classList.add("is-placed");
    resizer.observe(host);
    if (wordmark) resizer.observe(wordmark);
    if (!still) {
      watcher.observe(host);
      document.addEventListener("visibilitychange", sync);
      window.addEventListener("pointermove", lean, { passive: true });
    }

    return () => {
      stop();
      resizer.disconnect();
      watcher.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", lean);
    };
  }, [anchor]);

  return (
    <div ref={skyRef} className="lp-sky" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div ref={reticleRef} className="lp-reticle">
        <span className="lp-reticle-frame" />
        <span className="lp-reticle-label">
          <b>C/2026 · COMET</b>
          <span ref={readoutRef}>RA 16h 11m 42.6s · DEC +14° 36′</span>
        </span>
      </div>
    </div>
  );
}
