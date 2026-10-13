"use client";

import { motion, useAnimation, useReducedMotion, type Variants } from "motion/react";
import { forwardRef, useCallback, useImperativeHandle, useRef, type HTMLAttributes, type MouseEvent } from "react";
import { useIconCycle } from "@/components/use-icon-cycle";
import { cn } from "@/lib/utils";

export interface DownloadIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface DownloadIconProps extends HTMLAttributes<HTMLDivElement> { size?: number }

const ARROW_VARIANTS: Variants = {
  normal: { y: 0, transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } },
  animate: {
    y: [0, 2, 0],
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

/** The supplied download arrow, looping when its containing button or link is hovered. */
const DownloadIcon = forwardRef<DownloadIconHandle, DownloadIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, style, ...props }, ref) => {
    const controls = useAnimation();
    const cycleElement = useRef<HTMLDivElement>(null);
    useIconCycle(cycleElement, controls, { normal: "normal", enabled: !ref });
    const reducedMotion = useReducedMotion();
    const isControlled = useRef(false);
    const playing = useRef(false);
    const startAnimation = useCallback(() => {
      if (!reducedMotion && !playing.current) { playing.current = true; void controls.start("animate"); }
    }, [controls, reducedMotion]);
    const stopAnimation = useCallback(() => {
      playing.current = false;
      controls.stop();
      controls.set("normal");
    }, [controls]);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return { startAnimation, stopAnimation };
    }, [startAnimation, stopAnimation]);

    const handleMouseEnter = (event: MouseEvent<HTMLDivElement>) => {
      onMouseEnter?.(event);
      if (!isControlled.current) startAnimation();
    };
    const handleMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
      onMouseLeave?.(event);
      if (!isControlled.current && !cycleElement.current?.closest("button, a, [role='button']")) stopAnimation();
    };

    return <div ref={cycleElement} data-icon-motion="" className={cn(className)} style={{ display: "inline-flex", flexShrink: 0, lineHeight: 0, ...style }} onMouseEnter={ref ? handleMouseEnter : onMouseEnter} onMouseLeave={ref ? handleMouseLeave : onMouseLeave} {...props}>
      <svg fill="none" height={size} width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <motion.g initial="normal" animate={controls} variants={ARROW_VARIANTS}>
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" x2="12" y1="15" y2="3" />
        </motion.g>
      </svg>
    </div>;
  },
);
DownloadIcon.displayName = "DownloadIcon";
export { DownloadIcon };
