"use client";

import { motion, type Variants } from "motion/react";
import { getVariants, useAnimateIconContext, IconWrapper, type IconProps } from "./icon";

const animations = { default: {
  lid: { initial: { y: 0 }, animate: { y: -1.1 } }, body: { initial: { y: 0 }, animate: { y: 1 } }, line: { initial: { y: 0 }, animate: { y: 0.5 } }
} satisfies Record<string, Variants> } as const;
type Props = IconProps<keyof typeof animations>;

function IconComponent({ size, ...props }: Props) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);
  return <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.g variants={variants.lid} initial="initial" animate={controls} transition={{ type: "spring", stiffness: 500, damping: 30 }}><path d="M3 6h18" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></motion.g>
      <motion.path d="M19 8v12c0 1-1 2-2 2H7c-1 0-2-1-2-2V8" variants={variants.body} initial="initial" animate={controls} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
      <motion.g variants={variants.line} initial="initial" animate={controls} transition={{ type: "spring", stiffness: 500, damping: 30 }}><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></motion.g>
    </motion.svg>;
}

export function Delete(props: Props) { return <IconWrapper icon={IconComponent} {...props} />; }
