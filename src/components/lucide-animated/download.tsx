"use client";

import { motion, useAnimation, useReducedMotion, type Variants } from "motion/react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type HTMLAttributes, type MouseEvent } from "react";
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
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], repeat: Infinity, repeatDelay: 1.2 },
  },
};

/** The supplied download arrow, looping when its containing button or link is hovered. */
const DownloadIcon = forwardRef<DownloadIconHandle, DownloadIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, style, ...props }, ref) => {
    const controls = useAnimation();
    const reducedMotion = useReducedMotion();
    const element = useRef<HTMLDivElement>(null);
    const isControlled = useRef(false);
    const playing = useRef(false);
    const startAnimation = useCallback(() => {
      if (!reducedMotion && !playing.current) { playing.current = true; void controls.start("animate"); }
    }, [controls, reducedMotion]);
    const stopAnimation = useCallback(() => {
      playing.current = false;
      controls.stop();
      if (reducedMotion) controls.set("normal");
      else void controls.start("normal");
    }, [controls, reducedMotion]);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return { startAnimation, stopAnimation };
    }, [startAnimation, stopAnimation]);

    useEffect(() => {
      const control = element.current?.closest("button, a, [role='button']");
      if (!control) return;
      let hovered = false;
      let focused = false;
      const update = () => {
        if (isControlled.current) return;
        if ((hovered || focused) && !control.matches(":disabled, [aria-disabled='true']")) startAnimation();
        else stopAnimation();
      };
      const enter = () => { hovered = true; update(); };
      const leave = () => { hovered = false; update(); };
      const focus = () => { focused = control.matches(":focus-visible"); update(); };
      const blur = () => { focused = false; update(); };
      control.addEventListener("mouseenter", enter);
      control.addEventListener("mouseleave", leave);
      control.addEventListener("focus", focus);
      control.addEventListener("blur", blur);
      return () => {
        control.removeEventListener("mouseenter", enter);
        control.removeEventListener("mouseleave", leave);
        control.removeEventListener("focus", focus);
        control.removeEventListener("blur", blur);
        controls.stop();
        playing.current = false;
      };
    }, [controls, startAnimation, stopAnimation]);

    const handleMouseEnter = (event: MouseEvent<HTMLDivElement>) => {
      onMouseEnter?.(event);
      if (!isControlled.current) startAnimation();
    };
    const handleMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
      onMouseLeave?.(event);
      if (!isControlled.current && !element.current?.closest("button, a, [role='button']")) stopAnimation();
    };

    return <div ref={element} className={cn(className)} style={{ display: "inline-flex", flexShrink: 0, lineHeight: 0, ...style }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
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
