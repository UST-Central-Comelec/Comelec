"use client";

import { motion, useAnimation, useReducedMotion, type Variants } from "motion/react";
import { forwardRef, useCallback, useImperativeHandle, useRef, type HTMLAttributes, type MouseEvent } from "react";
import { useIconCycle } from "@/components/use-icon-cycle";
import { cn } from "@/lib/utils";

export interface UserRoundCogIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface UserRoundCogIconProps extends HTMLAttributes<HTMLDivElement> { size?: number }

const COG_VARIANTS: Variants = { normal: { rotate: 0 }, animate: { rotate: 180 } };
const COG_TRANSITION = { type: "spring" as const, stiffness: 50, damping: 10 };

const UserRoundCogIcon = forwardRef<UserRoundCogIconHandle, UserRoundCogIconProps>(
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
        <path d="M2 21a8 8 0 0 1 10.434-7.62" />
        <circle cx="10" cy="8" r="5" />
        <motion.g initial="normal" animate={controls} variants={COG_VARIANTS} transition={COG_TRANSITION} style={{ transformOrigin: "18px 18px" }}>
          <circle cx="18" cy="18" r="3" />

          <path d="m14.305 19.53.923-.382" />
          <path d="m15.228 16.852-.923-.383" />
          <path d="m16.852 15.228-.383-.923" />
          <path d="m16.852 20.772-.383.924" />
          <path d="m19.148 15.228.383-.923" />
          <path d="m19.53 21.696-.382-.924" />
          <path d="m20.772 16.852.924-.383" />
          <path d="m20.772 19.148.924.383" />
        </motion.g>
      </svg>
    </div>;
  },
);
UserRoundCogIcon.displayName = "UserRoundCogIcon";
export { UserRoundCogIcon };
