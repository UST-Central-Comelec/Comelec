"use client";

import { useLayoutEffect, useRef } from "react";
import { ToastPill } from "./online-notices";
import { useToasts } from "./toast";

/**
 * The pop-ups (toast.tsx) on their own, for a portal without who's-online: the party
 * portal. The same stack, bottom right, as a popover so it sits above an open dialog too.
 */
export function ToastStack() {
  const toasts = useToasts();
  const stack = useRef<HTMLDivElement>(null);
  const newest = toasts.at(-1)?.id ?? 0;

  // Shown again whenever something new arrives, so it goes above a dialog or menu opened since.
  useLayoutEffect(() => {
    const element = stack.current;
    if (!element?.showPopover) return;
    if (!toasts.length) {
      if (element.matches(":popover-open")) element.hidePopover();
      return;
    }
    if (element.matches(":popover-open")) element.hidePopover();
    element.showPopover();
  }, [toasts.length, newest]);

  return <div ref={stack} popover="manual" className="portal-online-notices" role="region" aria-label="Notifications">
    {toasts.toReversed().map((item) => <ToastPill key={item.id} item={item} />)}
  </div>;
}
