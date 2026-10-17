"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useImperativeHandle, useRef } from "react";

import { useIconCycle } from "@/components/use-icon-cycle";
import { cn } from "@/lib/utils";

export interface DatabaseIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface DatabaseIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// The two lower rings redraw in turn, top to bottom, like rows being filled.
const RING_VARIANTS: Variants = {
  visible: { pathLength: 1, opacity: 1 },
  hidden: { pathLength: 0, opacity: 0 },
};

const DatabaseIcon = forwardRef<DatabaseIconHandle, DatabaseIconProps>(
  ({ className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const cycleElement = useRef<HTMLDivElement>(null);
    useIconCycle(cycleElement, controls, { normal: "normal", enabled: !ref });

    useImperativeHandle(ref, () => ({
      startAnimation: async () => {
        await controls.start((i) => ({ pathLength: 0, opacity: 0, transition: { delay: i * 0.12, duration: 0.24 } }));
        await controls.start((i) => ({ pathLength: 1, opacity: 1, transition: { delay: i * 0.12, duration: 0.36 } }));
      },
      stopAnimation: () => controls.start("visible"),
    }));

    return (
      <div ref={cycleElement} data-icon-motion="" className={cn(className)} {...props}>
        <svg fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5V19A9 3 0 0 0 21 19V5" />
          <motion.path animate={controls} custom={0} d="M3 12A9 3 0 0 0 21 12" initial="visible" variants={RING_VARIANTS} />
        </svg>
      </div>
    );
  }
);

DatabaseIcon.displayName = "DatabaseIcon";

export { DatabaseIcon };
