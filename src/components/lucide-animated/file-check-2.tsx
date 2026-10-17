"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes, MouseEvent } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { useIconCycle } from "@/components/use-icon-cycle";
import { cn } from "@/lib/utils";

export interface FileCheck2IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface FileCheck2IconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const CHECK_VARIANTS: Variants = {
  normal: { pathLength: 1, opacity: 1, transition: { duration: 0.3 } },
  animate: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: {
      pathLength: { duration: 0.4, ease: "easeInOut" },
      opacity: { duration: 0.4, ease: "easeInOut" },
    },
  },
};

const FileCheck2Icon = forwardRef<FileCheck2IconHandle, FileCheck2IconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const cycleElement = useRef<HTMLDivElement>(null);
    useIconCycle(cycleElement, controls, { normal: "normal", enabled: !ref });
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => controls.start("animate"),
        stopAnimation: () => { controls.stop(); controls.set("normal"); },
      };
    });

    const handleMouseEnter = useCallback((event: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) onMouseEnter?.(event);
      else controls.start("animate");
    }, [controls, onMouseEnter]);

    const handleMouseLeave = useCallback((event: MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) onMouseLeave?.(event);
      else controls.start("normal");
    }, [controls, onMouseLeave]);

    return (
      <div ref={cycleElement} data-icon-motion="" className={cn(className)} onMouseEnter={ref ? handleMouseEnter : onMouseEnter} onMouseLeave={ref ? handleMouseLeave : onMouseLeave} {...props}>
        <svg fill="none" height={size} width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
          <motion.path animate={controls} d="m3 15 2 2 4-4" initial="normal" style={{ transformOrigin: "center" }} variants={CHECK_VARIANTS} />
        </svg>
      </div>
    );
  },
);

FileCheck2Icon.displayName = "FileCheck2Icon";
export { FileCheck2Icon };
