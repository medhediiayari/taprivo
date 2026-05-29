import type { Transition, Variants } from "motion/react";

export const spring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.9,
};

export const softSpring: Transition = {
  type: "spring",
  stiffness: 180,
  damping: 28,
  mass: 1,
};

export const lazySpring: Transition = {
  type: "spring",
  stiffness: 90,
  damping: 22,
  mass: 1.2,
};

export const ease: Transition = {
  duration: 0.6,
  ease: [0.16, 1, 0.3, 1],
};

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { ...ease, duration: 0.5 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } },
};

export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { ...ease, duration: 0.55 } },
};
