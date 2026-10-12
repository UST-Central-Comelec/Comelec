"use client";

import { useEffect } from "react";
import { headerOffset, scrollToElement, settleScroll } from "@/lib/scroll";

// Keeps the content in view when a button changes it: a form's Next, a tab, a filter. The browser
// keeps the scroll position when content is swapped, so a step or tab that ends higher up than the
// last one leaves the view past its end, on the footer. When a press changes the part of the page it's
// in (the form, the tab's panel, the section) and that part now starts above the screen and ends in
// its upper half, it's brought back to the top, under the header. Mounted in every root layout;
// nothing to add to a page.

/** What a press can change: buttons, tabs, links within the page, and forms being sent. */
const PRESSABLE = "button, [role='button'], [role='tab'], summary, a[href], input[type='submit']";
/** Controls that only open something over the page: menus, pickers, dialogs. */
const OVERLAY = "[popover], dialog, [role='listbox'], [role='menu'], .combobox, .portal-dropdown";
/** The part of the page a press changes, nearest first. */
const CONTAINER = "form, [role='tabpanel'], section, article, .portal-card, main";

/** How long a press is watched: a step changes at once, a saved form's result can take a few seconds. */
const WATCH_MS = 10_000;

/** Ends in the upper part of the screen: below it, what's shown is mostly what comes after it. */
const ENDS_ABOVE = 0.6;

type Watch = { container: Element; height: number; page: number; until: number };

export function ScrollKeeper() {
  useEffect(() => {
    let watch: Watch | null = null;
    let frame = 0;

    // Checked when the page changes size or scrolls (a shorter page moves the scroll), not every frame.
    const check = () => {
      if (!watch) return;
      if (performance.now() > watch.until) return stop();
      const target = watch.container.isConnected ? watch.container : document.querySelector("main");
      if (!target) return stop();
      const box = target.getBoundingClientRect();
      // Only once the press has changed something: a button that changes nothing never moves the page.
      const changed = !watch.container.isConnected || Math.abs(box.height - watch.height) > 1 || document.documentElement.scrollHeight !== watch.page;
      if (!changed) return;
      if (box.top < headerOffset() && box.bottom < window.innerHeight * ENDS_ABOVE) {
        scrollToElement(target);
        stop();
      }
    };
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    };
    const resized = new ResizeObserver(later);

    const start = (from: Element) => {
      settleScroll();
      const container = from.closest(CONTAINER) ?? document.body;
      watch = { container, height: container.getBoundingClientRect().height, page: document.documentElement.scrollHeight, until: performance.now() + WATCH_MS };
      resized.observe(document.body);
      window.addEventListener("scroll", later, { passive: true });
      later();
    };

    const onClick = (event: MouseEvent) => {
      const control = event.target instanceof Element ? event.target.closest(PRESSABLE) : null;
      if (!control || control.closest(OVERLAY)) return;
      // A link to another page: the router brings that page in at the top.
      if (control instanceof HTMLAnchorElement && !control.getAttribute("href")?.startsWith("#") && control.pathname !== window.location.pathname) return settleScroll();
      start(control);
    };
    const onSubmit = (event: SubmitEvent) => {
      // Held back by the form check (form-validation.tsx), which scrolls to the field itself.
      if (event.defaultPrevented) return stop();
      if (event.target instanceof HTMLFormElement) start(event.submitter ?? event.target);
    };
    // Someone scrolling on their own: what they scroll to is theirs.
    function stop() {
      watch = null;
      resized.disconnect();
      window.removeEventListener("scroll", later);
    }
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key) && !(event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']"))) stop();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("keydown", onKey, true);
    // Typing changes a form's size too; that's not a press changing the content.
    document.addEventListener("input", stop, true);
    return () => {
      cancelAnimationFrame(frame);
      stop();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("input", stop, true);
    };
  }, []);
  return null;
}
