"use client";

import { motion, useAnimation, useReducedMotion } from "motion/react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type HTMLAttributes } from "react";
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
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => { if (!reducedMotion) void controls.start("animate"); },
        stopAnimation: () => { controls.stop(); controls.set("normal"); },
      };
    }, [controls, reducedMotion]);

    useEffect(() => {
      if (loop && !reducedMotion) void controls.start("animate");
      else { controls.stop(); controls.set("normal"); }
      return () => controls.stop();
    }, [controls, loop, reducedMotion]);

    const handleMouseEnter = useCallback<NonNullable<LockOpenIconProps["onMouseEnter"]>>(event => {
      onMouseEnter?.(event);
      if (!isControlledRef.current && !loop && !reducedMotion) void controls.start("animate");
    }, [controls, loop, onMouseEnter, reducedMotion]);

    const handleMouseLeave = useCallback<NonNullable<LockOpenIconProps["onMouseLeave"]>>(event => {
      onMouseLeave?.(event);
      if (!isControlledRef.current && !loop) void controls.start("normal");
    }, [controls, loop, onMouseLeave]);

    return (
      <div className={cn(className)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
        <motion.svg animate={controls} initial="normal" fill="none" height={size} width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], repeat: loop ? Infinity : 0, repeatDelay: loop ? .5 : 0 }}
          variants={{ normal: { rotate: 0, scale: 1 }, animate: { rotate: [2, 4, -2, 0], scale: [1.05, .95, 1.02, 1] } }}>
          <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
          <motion.path animate={controls} initial="normal" d="M7 11V7a5 5 0 0 1 10 0v4"
            transition={{ duration: loop ? 1 : .3, ease: [0.4, 0, 0.2, 1], repeat: loop ? Infinity : 0, repeatDelay: loop ? .5 : 0 }}
            variants={{ normal: { pathLength: .8 }, animate: { pathLength: loop ? [.8, 1, .8] : 1 } }} />
        </motion.svg>
      </div>
    );
  }
);

LockOpenIcon.displayName = "LockOpenIcon";
