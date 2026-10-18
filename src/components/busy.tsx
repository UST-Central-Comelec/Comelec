"use client";

import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { AnimateIcon } from "./animate-ui/icons/icon";
import { Loader } from "./animate-ui/icons/loader";

/** The working spinner (Animate UI Loader). It plays for as long as it's shown, even on a disabled button. */
export function BusyIcon({ size = 15 }: { size?: number }) {
  const still = useReducedMotion();
  return (
    <AnimateIcon animate={!still} asChild>
      <span className="ui-busy-icon" data-icon-motion="" aria-hidden="true">
        <Loader size={size} className="lucide lucide-loader" />
      </span>
    </AnimateIcon>
  );
}

/** A label for work in progress: the spinner, then the words without an ellipsis ("Saving", "Sending"). */
export function Busy({ children, size }: { children: ReactNode; size?: number }) {
  return <span className="ui-busy"><BusyIcon size={size} />{children}</span>;
}
