"use client";

import { useEffect, useRef, useState, type PointerEvent, type MouseEvent, type KeyboardEvent, type RefObject } from "react";

type CanvasBounds = { width: number; height: number; zoom: number; centerVertically?: boolean };

/** Keep the viewport within the diagram plus a 10% margin on each side. */
export function boundedPan(value: number, diagram: number, viewport: number, centered: boolean) {
  const origin = centered ? Math.max(0, (viewport - diagram) / 2) : 0;
  const margin = diagram * .1;
  if (viewport >= diagram + margin * 2) return (viewport - diagram) / 2 - origin;
  return Math.max(viewport - diagram - margin - origin, Math.min(margin - origin, value));
}

/** Clicking toggles nodes; dragging or holding for 350 ms captures the pointer to pan. */
export function useCanvasPan(viewport: RefObject<HTMLDivElement | null>, stage: RefObject<HTMLDivElement | null>, bounds?: CanvasBounds) {
  const gesture = useRef<{ id: number; x: number; y: number; left: number; top: number; active: boolean; target: HTMLDivElement; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressClick = useRef(false);
  const [panning, setPanning] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  const frame = useRef<number | null>(null);
  const paint = () => {
    frame.current = null;
    for (const element of [stage.current, viewport.current]) {
      if (!element) continue;
      element.style.setProperty("--canvas-pan-x", `${offsetRef.current.x}px`);
      element.style.setProperty("--canvas-pan-y", `${offsetRef.current.y}px`);
    }
  };
  const flush = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    paint();
  };
  const constrain = (next: typeof offset, scale = bounds?.zoom) => {
    const element = viewport.current;
    if (!bounds || !element || scale === undefined) return next;
    const style = getComputedStyle(element);
    const width = element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    const height = element.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);
    return { x: boundedPan(next.x, bounds.width * scale, width, true), y: boundedPan(next.y, bounds.height * scale, height, !!bounds.centerVertically) };
  };
  const move = (next: typeof offset, scale?: number) => { const clamped = constrain(next, scale); offsetRef.current = clamped; flush(); setOffset(clamped); };
  const drag = (next: typeof offset) => {
    offsetRef.current = constrain(next);
    if (frame.current === null) frame.current = requestAnimationFrame(paint);
  };
  const stop = () => {
    const current = gesture.current;
    if (!current) return;
    clearTimeout(current.timer);
    gesture.current = null;
    if (current.target.hasPointerCapture(current.id)) current.target.releasePointerCapture(current.id);
    flush();
    setOffset(offsetRef.current);
    setPanning(false);
  };
  useEffect(() => () => {
    if (gesture.current) clearTimeout(gesture.current.timer);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);
  useEffect(() => {
    if (!bounds || !viewport.current) return;
    const reclamp = () => {
      const next = constrain(offsetRef.current);
      if (next.x !== offsetRef.current.x || next.y !== offsetRef.current.y) move(next);
    };
    reclamp();
    const observer = new ResizeObserver(reclamp);
    observer.observe(viewport.current);
    return () => observer.disconnect();
  });
  return {
    panning,
    offset,
    movePan: move,
    getOffset: () => offsetRef.current,
    resetPan: () => move({ x: 0, y: 0 }),
    handlers: {
      onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
        if (!event.isPrimary || event.button !== 0 || !viewport.current) return;
        stop();
        suppressClick.current = false;
        const target = event.currentTarget;
        const current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: offsetRef.current.x, top: offsetRef.current.y, active: false, target, timer: setTimeout(() => {
          if (gesture.current !== current) return;
          current.active = true;
          suppressClick.current = true;
          target.setPointerCapture(current.id);
          setPanning(true);
        }, 350) };
        gesture.current = current;
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        if (!current.active) {
          if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < 5) return;
          clearTimeout(current.timer);
          current.active = true;
          suppressClick.current = true;
          current.target.setPointerCapture(current.id);
          setPanning(true);
        }
        event.preventDefault();
        drag({ x: current.left + event.clientX - current.x, y: current.top + event.clientY - current.y });
      },
      onPointerUp: stop,
      onPointerCancel: stop,
      onLostPointerCapture: stop,
      onPointerLeave: () => { if (!gesture.current?.active) stop(); },
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
        if (!suppressClick.current || event.detail === 0) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      },
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        const delta = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[event.key];
        if (!delta) return;
        event.preventDefault();
        move({ x: offsetRef.current.x + delta[0], y: offsetRef.current.y + delta[1] });
      },
      onContextMenu: (event: MouseEvent<HTMLDivElement>) => event.preventDefault(),
    },
  };
}
