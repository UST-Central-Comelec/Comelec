"use client";

import { motion, useAnimation } from "motion/react";
import { forwardRef, useImperativeHandle, useRef, type HTMLAttributes } from "react";
import { useIconCycle } from "@/components/use-icon-cycle";
import { cn } from "@/lib/utils";

export interface LockOpenIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

const LockOpenIcon = forwardRef<LockOpenIconHandle, HTMLAttributes<HTMLDivElement> & { size?: number }>(
  ({ className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    const element = useRef<HTMLDivElement>(null);
    useIconCycle(element, controls, { normal: "normal", enabled: !ref });
    useImperativeHandle(ref, () => ({
      startAnimation: () => { void controls.start("animate"); },
      stopAnimation: () => { controls.stop(); controls.set("normal"); },
    }), [controls]);
    return <div ref={element} data-icon-motion="" className={cn(className)} style={{ display: "inline-flex", flexShrink: 0 }} {...props}>
      <motion.svg animate={controls} fill="none" height={size} initial="normal" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg"
        transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }} variants={{ normal: { rotate: 0, scale: 1 }, animate: { rotate: [2, 4, -2, 0], scale: [1.05, 0.95, 1.02, 1] } }}>
        <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
        <motion.path animate={controls} d="M7 11V7a5 5 0 0 1 10 0v4" initial="normal" transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} variants={{ normal: { pathLength: 0.8 }, animate: { pathLength: 1 } }} />
      </motion.svg>
    </div>;
  },
);
LockOpenIcon.displayName = "LockOpenIcon";
export { LockOpenIcon };
