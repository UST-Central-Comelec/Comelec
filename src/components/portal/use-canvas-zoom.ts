"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { flushSync } from "react-dom";

type Point = { x: number; y: number };
type ZoomOptions = { centerVertically?: boolean; zoom: number; minZoom?: number; width: number; height: number; offset: Point; getOffset?: () => Point; onZoom: (zoom: number) => void; onPan: (offset: Point, zoom: number) => void };
type GestureEvent = Event & { scale: number; clientX?: number; clientY?: number };

/** Keep the diagram point under the cursor fixed, including the canvas's changing auto margins. */
export function zoomOffset(zoom: number, nextZoom: number, cursor: Point, origin: Point, nextOrigin: Point): Point {
  return { x: cursor.x - nextOrigin.x - (cursor.x - origin.x) * nextZoom / zoom, y: cursor.y - nextOrigin.y - (cursor.y - origin.y) * nextZoom / zoom };
}

export function wheelZoom(zoom: number, delta: number, mode: number, height: number, pinch: boolean, minZoom = .05) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? height : 1);
  return Math.min(1.5, Math.max(minZoom, zoom * Math.exp(-Math.max(-100, Math.min(100, pixels)) * (pinch ? .006 : .0015))));
}

/** Native non-passive listeners stop page scrolling/browser zoom over this canvas only. */
export function useCanvasZoom(viewport: RefObject<HTMLDivElement | null>, stage: RefObject<HTMLDivElement | null>, options: ZoomOptions) {
  const latest = useRef(options);
  const controls = useRef<{ zoomTo: (value: number) => void; cancel: () => void }>({ zoomTo: () => {}, cancel: () => {} });
  useLayoutEffect(() => { latest.current = options; }, [options]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let gestureZoom: number | null = null;
    let frame: number | null = null;
    let target: { zoom: number; x?: number; y?: number } | null = null;
    const cancel = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; target = null; gestureZoom = null;
      element.classList?.remove("is-zooming");
    };
    const apply = (nextZoom: number, clientX?: number, clientY?: number) => {
      const diagram = stage.current;
      if (!diagram) return;
      const current = latest.current;
      nextZoom = Math.min(1.5, Math.max(current.minZoom ?? .05, nextZoom));
      if (nextZoom === current.zoom) return;
      const view = element.getBoundingClientRect();
      const cursor = { x: clientX ?? view.left + element.clientWidth / 2, y: clientY ?? view.top + element.clientHeight / 2 };
      const style = typeof getComputedStyle === "function" ? getComputedStyle(element) : null;
      const left = parseFloat(style?.paddingLeft ?? "0") || 0, right = parseFloat(style?.paddingRight ?? "0") || 0;
      const top = parseFloat(style?.paddingTop ?? "0") || 0, bottom = parseFloat(style?.paddingBottom ?? "0") || 0;
      const width = element.clientWidth - left - right, height = element.clientHeight - top - bottom;
      const base = { x: view.left + element.clientLeft - element.scrollLeft + left, y: view.top + element.clientTop - element.scrollTop + top };
      const pan = current.getOffset?.() ?? current.offset;
      const origin = { x: base.x + Math.max(0, (width - current.width * current.zoom) / 2) + pan.x, y: base.y + (current.centerVertically ? Math.max(0, (height - current.height * current.zoom) / 2) : 0) + pan.y };
      const nextOrigin = { x: base.x + Math.max(0, (width - current.width * nextZoom) / 2), y: base.y + (current.centerVertically ? Math.max(0, (height - current.height * nextZoom) / 2) : 0) };
      const offset = zoomOffset(current.zoom, nextZoom, cursor, origin, nextOrigin);
      latest.current = { ...current, zoom: nextZoom, offset };
      // Commit scale, translation and grid spacing before the browser paints this frame.
      flushSync(() => {
        current.onZoom(nextZoom);
        current.onPan(offset, nextZoom);
      });
    };
    const animate = () => {
      frame = null;
      if (!target) return;
      const goal = Math.min(1.5, Math.max(latest.current.minZoom ?? .05, target.zoom));
      const difference = goal - latest.current.zoom;
      const next = Math.abs(difference) < .0002 ? goal : latest.current.zoom + difference * .32;
      apply(next, target.x, target.y);
      if (Math.abs(goal - latest.current.zoom) < .000001) {
        target = null;
        element.classList?.remove("is-zooming");
      }
      else frame = requestAnimationFrame(animate);
    };
    const schedule = (zoom: number, x?: number, y?: number) => {
      const clampedZoom = Math.min(1.5, Math.max(latest.current.minZoom ?? .05, zoom));
      // At a zoom limit, wheel events must not repeatedly pause/resume the canvas animations.
      if (clampedZoom === latest.current.zoom) {
        cancel();
        return;
      }
      target = { zoom: clampedZoom, x, y };
      element.classList?.add("is-zooming");
      if (frame === null) frame = requestAnimationFrame(animate);
    };
    controls.current = { zoomTo: value => schedule(value), cancel };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (gestureZoom !== null || event.deltaY === 0) return;
      schedule(wheelZoom(target?.zoom ?? latest.current.zoom, event.deltaY, event.deltaMode, element.clientHeight, event.ctrlKey, latest.current.minZoom), event.clientX, event.clientY);
    };
    const start = (event: Event) => { event.preventDefault(); gestureZoom = latest.current.zoom; };
    const change = (event: Event) => {
      event.preventDefault();
      const gesture = event as GestureEvent;
      if (gestureZoom !== null && Number.isFinite(gesture.scale)) schedule(gestureZoom * gesture.scale, gesture.clientX, gesture.clientY);
    };
    const end = (event: Event) => { event.preventDefault(); gestureZoom = null; };
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("gesturestart", start, { passive: false });
    element.addEventListener("gesturechange", change, { passive: false });
    element.addEventListener("gestureend", end, { passive: false });
    return () => {
      cancel();
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("gesturestart", start);
      element.removeEventListener("gesturechange", change);
      element.removeEventListener("gestureend", end);
    };
  }, [viewport, stage]);
  return { zoomTo: (value: number) => controls.current.zoomTo(value), cancel: () => controls.current.cancel() };
}
