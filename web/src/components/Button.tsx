import { motion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { spring } from "../lib/motion";

type Variant = "primary" | "secondary" | "ghost" | "terracotta";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "ref"> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-2 disabled:bg-muted",
  secondary: "bg-paper-2 text-ink hover:bg-hairline disabled:opacity-50",
  ghost: "bg-transparent text-ink hover:bg-paper-2",
  terracotta: "bg-terracotta-2 text-paper hover:bg-terracotta disabled:bg-muted",
};

const sizes = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-[14px]",
  lg: "h-14 px-7 text-[15px]",
};

export const Button = ({
  variant = "primary",
  size = "md",
  full,
  className = "",
  children,
  ...rest
}: Props) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    transition={spring}
    className={[
      "relative inline-flex items-center justify-center rounded-full font-medium tracking-tight",
      "transition-colors duration-200 select-none whitespace-nowrap",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
      variants[variant],
      sizes[size],
      full ? "w-full" : "",
      className,
    ].join(" ")}
    {...(rest as object)}
  >
    {children}
  </motion.button>
);
