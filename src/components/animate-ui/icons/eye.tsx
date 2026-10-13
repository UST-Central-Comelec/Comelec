"use client";

import { motion, type Variants } from "motion/react";
import { getVariants, useAnimateIconContext, IconWrapper, type IconProps } from "./icon";

const animations = { default: {
  eye: { initial: { scaleY: 1, opacity: 1 }, animate: { scaleY: [1, 0.1, 1], opacity: [1, 0.3, 1], transition: { duration: 0.4, ease: "easeInOut" } } }, pupil: { initial: { scale: 1, opacity: 1 }, animate: { scale: [1, 0.3, 1], opacity: [1, 0.3, 1], transition: { duration: 0.4, ease: "easeInOut" } } }
} satisfies Record<string, Variants> } as const;
type Props = IconProps<keyof typeof animations>;

function IconComponent({ size, ...props }: Props) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);
  return <motion.svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" style={{ originY: "50%" }} variants={variants.eye} initial="initial" animate={controls} />
      <motion.circle cx="12" cy="12" r="3" variants={variants.pupil} initial="initial" animate={controls} />
    </motion.svg>;
}

export function Eye(props: Props) { return <IconWrapper icon={IconComponent} {...props} />; }
