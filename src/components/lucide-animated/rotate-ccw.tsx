"use client";

import { motion, useAnimation } from "motion/react";
import { forwardRef, useImperativeHandle, useRef, type HTMLAttributes } from "react";
import { useIconCycle } from "@/components/use-icon-cycle";
import { cn } from "@/lib/utils";

export interface RotateCCWIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface RotateCCWIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const RotateCCWIcon = forwardRef<RotateCCWIconHandle, RotateCCWIconProps>(
  ({ className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const element = useRef<HTMLDivElement>(null);
    useIconCycle(element, controls, { normal: "normal", enabled: !ref });
    useImperativeHandle(ref, () => ({
      startAnimation: () => { void controls.start("animate"); },
      stopAnimation: () => { controls.stop(); controls.set("normal"); },
    }), [controls]);

    return <div ref={element} data-icon-motion="" className={cn(className)} style={{ display: "inline-flex", flexShrink: 0 }} {...props}>
      <motion.svg animate={controls} initial="normal" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" transition={{ type: "spring", stiffness: 250, damping: 25 }} variants={{ normal: { rotate: "0deg" }, animate: { rotate: "-50deg" } }} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </motion.svg>
    </div>;
  },
);

RotateCCWIcon.displayName = "RotateCCWIcon";
export { RotateCCWIcon };
