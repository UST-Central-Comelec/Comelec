"use client";

import { useEffect, type RefObject } from "react";

export const ICON_CYCLE_MS = 2800;
const ICON_RESET_MS = 2000;
const controlSelector = 'button, a, [role="button"], [role="tab"], [role="switch"], [role="radio"], label';
const selectedSelector = '[aria-pressed="true"], [aria-selected="true"], [aria-checked="true"], [aria-current]:not([aria-current="false"]), [data-state="on"], [data-state="checked"], .is-active, .is-selected';

/** One cadence for both icon libraries, with time to finish and return smoothly before replaying. */
export function useIconCycle(
  element: RefObject<HTMLElement | null>,
  controls: { stop: () => void; set: (variant: string) => void; start: (variant: string) => unknown },
  { active = false, normal = "initial", enabled = true }: { active?: boolean; normal?: string; enabled?: boolean } = {},
) {
  useEffect(() => {
    const root = element.current;
    if (!root || !enabled) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Search icons also respond to focus/hover anywhere in their search field.
    const target = root.closest(controlSelector) ?? root.closest('[role="search"], [class*="search"]') ?? root;
    let interval: ReturnType<typeof setInterval> | undefined;
    let reset: ReturnType<typeof setTimeout> | undefined;
    const stop = (resetPose = true) => {
      clearInterval(interval);
      clearTimeout(reset);
      interval = undefined;
      controls.stop();
      if (resetPose) controls.set(normal);
    };
    const cycle = () => {
      void controls.start("animate");
      // The longest supplied motion is 1.8 seconds. Finish it before easing back,
      // then leave a quiet gap before the next 2.8-second cycle.
      reset = setTimeout(() => { void controls.start(normal); }, ICON_RESET_MS);
    };
    const update = () => {
      const disabled = target.matches(':disabled, [aria-disabled="true"], [aria-busy="true"]') || Boolean(target.closest('[inert], [hidden], fieldset[disabled]'));
      const selected = !target.hasAttribute("data-icon-interaction-only") && (target.matches(selectedSelector) || Boolean(target.querySelector('input:checked')));
      const engaged = target.matches(":hover, :focus-visible") || Boolean(target.querySelector("input:focus-visible"));
      if (!motionPreference.matches && !document.hidden && !disabled && (active || selected || engaged)) {
        if (!interval) { cycle(); interval = setInterval(cycle, ICON_CYCLE_MS); }
      } else stop();
    };
    const observer = new MutationObserver(update);
    observer.observe(target, { attributes: true, attributeFilter: ["disabled", "aria-disabled", "aria-busy", "aria-pressed", "aria-selected", "aria-checked", "aria-current", "data-state", "class", "hidden"] });
    for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === "FIELDSET") observer.observe(ancestor, { attributes: true, attributeFilter: ["disabled"] });
    }
    for (const event of ["mouseenter", "mouseleave", "focusin", "focusout", "change"]) target.addEventListener(event, update);
    document.addEventListener("visibilitychange", update);
    motionPreference.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      for (const event of ["mouseenter", "mouseleave", "focusin", "focusout", "change"]) target.removeEventListener(event, update);
      document.removeEventListener("visibilitychange", update);
      motionPreference.removeEventListener("change", update);
      // Motion's own mount effect may already have cleaned up (including Strict Mode).
      stop(false);
    };
  }, [element, controls, active, normal, enabled]);
}
