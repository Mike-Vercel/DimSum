import type { Transition } from "motion/react";

/** Motion presets: quick, physical, never bouncy enough to feel playful in a checkout. */
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 36, mass: 0.7 },
  smooth: { type: "spring", stiffness: 320, damping: 34 },
  gentle: { type: "spring", stiffness: 200, damping: 28 },
  sheet: { type: "spring", stiffness: 380, damping: 40 },
  pop: { type: "spring", stiffness: 600, damping: 22, mass: 0.6 },
} satisfies Record<string, Transition>;

export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
};

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.26, ease: ease.out },
};
