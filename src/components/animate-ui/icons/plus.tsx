"use client";

import { motion, type Variants } from "motion/react";
import { getVariants, useAnimateIconContext, IconWrapper, type IconProps } from "./icon";

const animations = { default: {
  group: { initial: { rotate: 0 }, animate: { rotate: 180, transition: { type: "spring", stiffness: 100, damping: 15 } } }
} satisfies Record<string, Variants> } as const;
type Props = IconProps<keyof typeof animations>;

function IconComponent({ size, ...props }: Props) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);
  return <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.g variants={variants.group} initial="initial" animate={controls} style={{ transformOrigin: "12px 12px" }}><path d="M5 12h14" /><path d="M12 5v14" /></motion.g>
    </motion.svg>;
}

export function Plus(props: Props) { return <IconWrapper icon={IconComponent} {...props} />; }
