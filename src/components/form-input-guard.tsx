"use client";

import { useEffect } from "react";
import { sanitizeFormInput, withoutEmoji } from "@/lib/forms/input";

/** Clean input before React reads it, including pasted text and controlled fields. */
export function FormInputGuard() {
  useEffect(() => {
    const clean = (event: Event) => {
      const field = event.target;
      if (event instanceof InputEvent && event.isComposing) return;
      const editable = field instanceof HTMLElement ? field.closest<HTMLElement>('[contenteditable="true"]') : null;
      if (editable) {
        const selection = window.getSelection();
        const anchor = selection?.anchorNode;
        const focus = selection?.focusNode;
        let anchorOffset = selection?.anchorOffset ?? 0;
        let focusOffset = selection?.focusOffset ?? 0;
        const nodes = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
        let changed = false;
        while (nodes.nextNode()) {
          const node = nodes.currentNode as Text;
          const value = node.data;
          const next = withoutEmoji(value);
          if (value === next) continue;
          if (node === anchor) anchorOffset = withoutEmoji(value.slice(0, anchorOffset)).length;
          if (node === focus) focusOffset = withoutEmoji(value.slice(0, focusOffset)).length;
          node.data = next;
          changed = true;
        }
        if (changed && anchor && focus && editable.contains(anchor) && editable.contains(focus)) selection?.setBaseAndExtent(anchor, anchorOffset, focus, focusOffset);
        if (changed && event.type === "compositionend") editable.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
      if (field instanceof HTMLInputElement && !["text", "search", "email", "url", "tel", "password"].includes(field.type)) return;
      const value = field.value;
      const next = sanitizeFormInput(value, field.name);
      if (next === value) return;
      const start = field.selectionStart;
      const end = field.selectionEnd;
      // Bypass React's value tracker so onChange receives the cleaned value.
      const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, next);
      if (start !== null && end !== null) {
        field.setSelectionRange(sanitizeFormInput(value.slice(0, start), field.name).length, sanitizeFormInput(value.slice(0, end), field.name).length);
      }
      if (event.type === "compositionend") field.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.addEventListener("input", clean, true);
    document.addEventListener("compositionend", clean, true);
    return () => {
      document.removeEventListener("input", clean, true);
      document.removeEventListener("compositionend", clean, true);
    };
  }, []);
  return null;
}
