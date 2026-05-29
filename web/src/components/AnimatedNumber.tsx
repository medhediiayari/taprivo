import { animate, useMotionValue, useTransform } from "motion/react";
import { motion } from "motion/react";
import { useEffect } from "react";

type Props = {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
};

export const AnimatedNumber = ({ value, duration = 0.9, className, format }: Props) => {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => (format ? format(v) : Math.round(v).toString()));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [value, duration, mv]);

  return <motion.span className={`font-tabular ${className ?? ""}`}>{rounded}</motion.span>;
};
