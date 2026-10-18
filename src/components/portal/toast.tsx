"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

// Every "Saved.", "Copied", "Couldn't save" in the portal: a pill in the bottom-right stack, beside the
// Following pill (online-notices.tsx), rather than a line somewhere on the page. Anything can call
// `toast()`; a server page renders <Toast> instead.

export type ToastTone = "ok" | "warn" | "error";
export type ToastItem = { id: number; message: string; tone: ToastTone };

let items: ToastItem[] = [];
let next = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Shows `message` at the bottom right. The same message twice in a row only refreshes the one already there. */
export function toast(message: string, tone: ToastTone = "ok") {
  if (!message) return;
  const same = items.find((item) => item.message === message && item.tone === tone);
  items = [...items.filter((item) => item !== same), { id: ++next, message, tone }].slice(-4);
  emit();
}

export function dismissToast(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

/** Long enough to read: longer messages and errors stay longer. Hovering keeps one up. */
export function toastDuration({ message, tone }: ToastItem) {
  return Math.min(16_000, Math.max(tone === "ok" ? 4000 : 7000, 2500 + message.length * 55));
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const none: ToastItem[] = [];

export function useToasts() {
  return useSyncExternalStore(subscribe, () => items, () => none);
}

/**
 * Pops `message` up when it changes. `on` is what decides a new one: pass the action's result so the
 * same error after a second try shows again.
 */
export function useToast(message: string | null | undefined, tone: ToastTone = "ok", on?: unknown) {
  useEffect(() => {
    if (message) toast(message, tone);
  }, [message, tone, on]);
}

/**
 * For a server page: shows the message, then takes `param` off the address so a reload doesn't
 * repeat it. Doing the same thing again puts `param` back, which shows it again.
 */
export function Toast({ message, tone = "ok", param }: { message: string; tone?: ToastTone; param?: string }) {
  const present = useSearchParams().has(param ?? "");
  useEffect(() => {
    if (param && !present) return;
    toast(message, tone);
    if (!param) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [message, tone, param, present]);
  return null;
}
