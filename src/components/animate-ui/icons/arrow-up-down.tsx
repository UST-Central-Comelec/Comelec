"use client";

import { motion, type Variants } from "motion/react";
import { getVariants, IconWrapper, useAnimateIconContext, type IconProps } from "./icon";

const animations = {
  default: {
    up: {
      initial: { y: 0 },
      animate: { y: [0, -1.5, 0], transition: { duration: .6, ease: "easeInOut" } },
    },
    down: {
      initial: { y: 0 },
      animate: { y: [0, 1.5, 0], transition: { duration: .6, ease: "easeInOut" } },
    },
  } satisfies Record<string, Variants>,
};

type ArrowUpDownProps = IconProps<keyof typeof animations>;

function IconComponent({ size, ...props }: ArrowUpDownProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);
  return (
    <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <motion.path d="m3 8 4-4 4 4 M7 4v16" variants={variants.up} initial="initial" animate={controls} />
      <motion.path d="m21 16-4 4-4-4 M17 20V4" variants={variants.down} initial="initial" animate={controls} />
    </motion.svg>
  );
}

export function ArrowUpDown(props: ArrowUpDownProps) {
  return <IconWrapper icon={IconComponent} {...props} />;
}
