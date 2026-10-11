"use client";

import { useEffect, useRef } from "react";
import { bandAt, createGoldMonoliths, type GoldMonoliths, type MonolithLayout, type MonolithPose } from "./gold-monoliths";

/* The three pillars of the Student Government landing as monoliths of solid gold (gold-monoliths.ts draws them). They
   stand exactly over the banners in the page, so the crests and words sit on their faces. Each time the view opens,
   light climbs their edges from their feet and meets over their tops as their faces come up out of the dark; then a
   strip of light passes across them, and again every few seconds. The light leans after the pointer, and when a
   banner is pointed at, its monolith takes a spot and the others step back. The headline glints where the strip
   crosses (`--sg-band` on the intro, its distance from the middle). The flat banners stay in the page for
   where WebGL can't run: the canvas carries `data-pending` while the monoliths are on their way and `data-live` once
   they're drawn, and the page hides the flat ones while it has either. */

/** Where the banners' artwork (the stage) lies on the canvas, which overhangs it on every side for the glow and the
    glass. */
function measure(canvas: HTMLCanvasElement, stage: HTMLElement): MonolithLayout | null {
  const c = canvas.getBoundingClientRect(), s = stage.getBoundingClientRect();
  if (!c.width || !c.height || !s.width || !s.height) return null;
  return { width: c.width, height: c.height, stage: [s.left - c.left, s.top - c.top, s.width, s.height] };
}

/** How much of the screen's resolution the scene draws at. If frames come too slowly while it moves, it's lowered for
    the rest of the visit, a step at a time. */
let quality = 1;

/** The light climbs the edges first; the faces come up after it, from `RISE_AT`. All in seconds. */
const CLIMB = 1.5;
const RISE_AT = 0.35;
const RISE = 1.4;
/** The strip of light: how long it takes to pass, how soon after the lights come up it first passes, and how long it
    rests between passes, in seconds. */
const SWEEP = 2.6;
const FIRST_SWEEP = 1.6;
const SWEEP_REST = 6.5;
/** After this many more passes with no one moving, the strip rests until someone does. */
const SWEEPS = 4;
/** Where the strip sets off and where it ends, as tangents: just clear of the three either side. */
const SWEEP_FROM = -0.62;

const clamp = (x: number, low = 0, high = 1) => Math.min(high, Math.max(low, x));
const ease = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

/** The monoliths over the banners. `active` is the banner pointed at, if any. */
export function Monoliths({ active }: { active: number | null }) {
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
    const stage = canvas?.parentElement;
    const intro = section?.querySelector<HTMLElement>(".sg-intro");
    if (!canvas || !section || !stage) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let scene: GoldMonoliths | null = null;
    let unavailable = typeof WebGL2RenderingContext === "undefined", lost = false, onScreen = false, shown = false;
    let fitted = "";
    let frame = 0, last = 0, clock = 0, timer = 0, passes = 0;
    // On the scene's clock, which only runs while it draws: when the lights last came up and when the strip last set
    // off. In page time: when the view was last left.
    let litAt = -100, sweepAt = -100, leftAt = -Infinity;
    const lean: [number, number] = [0, 0], leanTo: [number, number] = [0, 0];
    // Where the pointer last was over the section, read once a frame.
    let pointer: [number, number] | null = null;
    let risen = "", band = "", stageWidth = 0;
    const focus: [number, number, number] = [0, 0, 0];
    const gaps: number[] = [];
    // Where WebGL2 is likely, the flat banners give way at once, so they don't show before the monoliths come up. The
    // crests and words on them come up with the light (`--sg-rise`), so they don't float on the dark slabs.
    if (!unavailable) {
      canvas.dataset.pending = "";
      stage.style.setProperty("--sg-rise", "0");
    }

    const aimed = () => [0, 1, 2].map((i) => (activeRef.current === i ? 1 : 0));
    const live = () => !!scene && onScreen && !document.hidden && !lost && !motion.matches;

    const create = () => {
      if (scene || unavailable || lost) return;
      scene = createGoldMonoliths(canvas);
      if (!scene) {
        unavailable = true;
        delete canvas.dataset.pending;
        stage.style.removeProperty("--sg-rise");
      }
    };

    /** Measures the stage and rebuilds the scene if anything moved. */
    const fit = () => {
      const next = measure(canvas, stage);
      if (!next || !scene) return false;
      stageWidth = next.stage[2];
      const ratio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(3.4e6 / (next.width * next.height))) * quality);
      const key = [...Object.values(next).flat().map(Math.round), ratio.toFixed(2)].join();
      if (key !== fitted) {
        fitted = key;
        scene.resize(next, ratio);
      }
      return true;
    };

    const pose = (): MonolithPose => {
      if (motion.matches) return { time: 0, rise: 1, trace: 1, lean: [0, 0], focus: aimed() as MonolithPose["focus"], sweep: null };
      const since = clock - litAt, passing = (clock - sweepAt) / SWEEP;
      return {
        time: clock,
        rise: ease((since - RISE_AT) / RISE),
        trace: ease((since - 0.05) / CLIMB),
        lean: [lean[0], lean[1]],
        focus: [focus[0], focus[1], focus[2]],
        sweep: passing >= 0 && passing <= 1 ? SWEEP_FROM * (1 - 2 * ease(passing)) : null,
      };
    };

    const draw = () => {
      if (!scene) return;
      const now = pose();
      scene.render(now);
      if (now.rise.toFixed(3) !== risen) {
        risen = now.rise.toFixed(3);
        stage.style.setProperty("--sg-rise", risen);
      }
      const crossing = now.sweep === null ? "" : `${bandAt(now.sweep, stageWidth).toFixed(1)}px`;
      if (crossing !== band) {
        band = crossing;
        if (band) intro?.style.setProperty("--sg-band", band);
        else intro?.style.removeProperty("--sg-band");
      }
      if (canvas.dataset.live === undefined) {
        canvas.dataset.live = "";
        delete canvas.dataset.pending;
      }
    };

    /** Whether anything is still on the move. */
    const busy = () => {
      const target = aimed();
      return clock - litAt < Math.max(RISE_AT + RISE, CLIMB + 0.05)
        || clock - sweepAt < SWEEP
        || !!pointer
      || Math.abs(lean[0] - leanTo[0]) + Math.abs(lean[1] - leanTo[1]) > 0.002
        || focus.some((f, i) => Math.abs(f - target[i]) > 0.002);
    };

    const tick = (now: number) => {
      frame = 0;
      // Once the lights are up, the time between frames tells whether this screen can keep up with the scene.
      if (last && clock - litAt > RISE_AT + RISE) {
        gaps.push(now - last);
        if (gaps.length > 45) gaps.shift();
        if (gaps.length === 45 && quality > 0.55 && [...gaps].sort((a, b) => a - b)[22] > 24) {
          quality *= 0.75;
          gaps.length = 0;
          fit();
        }
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      clock += dt;
      last = now;
      if (pointer) {
        const box = stage.getBoundingClientRect();
        if (box.width) {
          leanTo[0] = clamp((pointer[0] - box.left - box.width / 2) / (box.width / 2), -1, 1);
          leanTo[1] = clamp((pointer[1] - box.top - box.height * 0.45) / (box.height / 2), -1, 1);
        }
        pointer = null;
      }
      const target = aimed();
      const follow = 1 - Math.exp(-dt * 4), turn = 1 - Math.exp(-dt * 8);
      for (const i of [0, 1]) lean[i] += (leanTo[i] - lean[i]) * follow;
      for (const i of [0, 1, 2]) focus[i] += (target[i] - focus[i]) * turn;
      draw();
      if (live() && busy()) {
        frame = requestAnimationFrame(tick);
        return;
      }
      // At rest: the strip passes again after a while.
      last = 0;
      gaps.length = 0;
      if (live() && !timer && passes < SWEEPS)
        timer = window.setTimeout(() => {
          timer = 0;
          passes += 1;
          sweepAt = clock;
          start();
        }, SWEEP_REST * 1000);
    };

    const start = () => {
      if (frame || !live()) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      frame = timer = last = 0;
    };

    const sync = () => {
      if (!onScreen || document.hidden) {
        stop();
        if (shown) {
          shown = false;
          leftAt = performance.now();
        }
        return;
      }
      create();
      if (!scene || !fit()) return;
      if (!shown) {
        shown = true;
        // Back within a moment, it carries on; after longer, the lights come up again.
        if (performance.now() - leftAt > 1200) {
          litAt = clock;
          sweepAt = clock + FIRST_SWEEP;
          passes = 0;
        }
      }
      if (motion.matches) {
        stop();
        draw();
        return;
      }
      start();
    };
    syncRef.current = sync;

    // Light that leans after the pointer, back to square when it leaves.
    const point = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = [event.clientX, event.clientY];
      passes = 0;
      start();
    };
    const away = () => {
      pointer = null;
      leanTo[0] = leanTo[1] = 0;
      start();
    };
    section.addEventListener("pointermove", point, { passive: true });
    section.addEventListener("pointerleave", away);

    // Pointing at the tab that opens this view starts the scene, so it's ready by the time the view shows.
    const tab = document.getElementById("hero-tab-government");
    tab?.addEventListener("pointerenter", create);
    tab?.addEventListener("focus", create);

    const resize = new ResizeObserver(() => {
      if (!scene || !fit() || !onScreen) return;
      if (!frame) draw();
    });
    resize.observe(section);
    const visible = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    visible.observe(canvas);
    // While the context is lost, the flat banners and their words stand in again.
    const handleLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      stop();
      delete canvas.dataset.live;
      stage.style.removeProperty("--sg-rise");
      intro?.style.removeProperty("--sg-band");
      risen = band = "";
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

    return () => {
      stop();
      syncRef.current = () => {};
      section.removeEventListener("pointermove", point);
      section.removeEventListener("pointerleave", away);
      tab?.removeEventListener("pointerenter", create);
      tab?.removeEventListener("focus", create);
      resize.disconnect();
      visible.disconnect();
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      scene?.dispose();
      delete canvas.dataset.live;
      delete canvas.dataset.pending;
      stage.style.removeProperty("--sg-rise");
      intro?.style.removeProperty("--sg-band");
    };
  }, []);

  return <canvas ref={canvasRef} className="sg-monoliths" aria-hidden="true" />;
}
