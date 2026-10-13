"use client";

import { motion, useAnimation, useReducedMotion, type Variants } from "motion/react";
import { forwardRef, useCallback, useImperativeHandle, useRef, type HTMLAttributes, type MouseEvent } from "react";
import { useIconCycle } from "@/components/use-icon-cycle";
import { cn } from "@/lib/utils";

export interface UserPlusIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface UserPlusIconProps extends HTMLAttributes<HTMLDivElement> { size?: number }

const PLUS_VARIANTS: Variants = {
  normal: { scale: 1, rotate: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  animate: {
    scale: [0, 1.15, 1], rotate: [-90, 0, 0], opacity: [0, 1, 1],
    transition: { delay: 0.25, duration: 0.45, ease: "easeOut", times: [0, 0.7, 1] },
  },
};

const UserPlusIcon = forwardRef<UserPlusIconHandle, UserPlusIconProps>(
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
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <motion.g initial="normal" animate={controls} variants={PLUS_VARIANTS} style={{ transformOrigin: "19px 11px" }}>
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </motion.g>
      </svg>
    </div>;
  },
);
UserPlusIcon.displayName = "UserPlusIcon";
export { UserPlusIcon };
