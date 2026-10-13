"use client";

import { motion, useAnimation, useReducedMotion } from "motion/react";
import { forwardRef, useImperativeHandle, useRef, type HTMLAttributes } from "react";
import { useIconCycle } from "@/components/use-icon-cycle";
import { cn } from "@/lib/utils";

export interface LockOpenIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface LockOpenIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  loop?: boolean;
}

export const LockOpenIcon = forwardRef<LockOpenIconHandle, LockOpenIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, loop = false, ...props }, ref) => {
    const controls = useAnimation();
    const reducedMotion = useReducedMotion();
    const element = useRef<HTMLDivElement>(null);
    useIconCycle(element, controls, { active: loop, normal: "normal", enabled: !ref });

    useImperativeHandle(ref, () => {
      return {
        startAnimation: () => { if (!reducedMotion) void controls.start("animate"); },
        stopAnimation: () => { controls.stop(); controls.set("normal"); },
      };
    }, [controls, reducedMotion]);

    return (
      <div ref={element} data-icon-motion="" className={cn(className)} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...props}>
        <motion.svg animate={controls} initial="normal" fill="none" height={size} width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
          variants={{ normal: { rotate: 0, scale: 1 }, animate: { rotate: [2, 4, -2, 0], scale: [1.05, .95, 1.02, 1] } }}>
          <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
          <motion.path animate={controls} initial="normal" d="M7 11V7a5 5 0 0 1 10 0v4"
            transition={{ duration: loop ? 1 : .3, ease: [0.4, 0, 0.2, 1] }}
            variants={{ normal: { pathLength: .8 }, animate: { pathLength: loop ? [.8, 1, .8] : 1 } }} />
        </motion.svg>
      </div>
    );
  }
);

LockOpenIcon.displayName = "LockOpenIcon";
