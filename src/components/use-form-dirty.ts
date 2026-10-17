"use client";

import { useEffect, useState, type RefObject } from "react";

/** Stable across object key order, while preserving field and list order. */
export function formValueStamp(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
    : item);
}

/** Tracks native fields and controlled pickers, whose values live in hidden inputs. */
export function useFormDirty(container: RefObject<HTMLElement | null>): boolean {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const snapshot = () => formValueStamp(Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input[name], textarea[name], select[name]"))
      .filter(field => !["button", "submit", "reset"].includes(field.type))
      .map(field => [field.name, field.type === "checkbox" || field.type === "radio"
        ? (field as HTMLInputElement).checked ? field.value : null
        : field.value]));
    const initial = snapshot();
    const update = () => setDirty(snapshot() !== initial);
    root.addEventListener("input", update);
    root.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["value", "checked", "name"] });
    return () => {
      root.removeEventListener("input", update);
      root.removeEventListener("change", update);
      observer.disconnect();
    };
  }, [container]);
  return dirty;
}
