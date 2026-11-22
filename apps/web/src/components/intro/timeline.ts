import type { MascotPose } from "@/components/mascot/rig";

/**
 * Opening choreography, in seconds. The mascot is seen from behind, holding the red hem of the
 * page in both hands:
 *   0.00–0.55  it comes down into view from the top edge, dragging the hem;
 *   0.55–3.10  it walks downwards step by step, pulling the page down behind it, and walks off the
 *              bottom of the screen. The page hem follows its hands, including each step's bob.
 */
export const INTRO_DURATION = 3.1;

/** Fraction of the mascot height between the feet and the hands, for the 2D fallback. */
export const FALLBACK_GRIP_RATIO = 0.3;

/** Natural blink: eyes closed for ~120 ms every 3.4 s. */
export function blinkAt(time: number): number {
  const period = 3.4;
  const phase = (time + 1.3) % period;
  return phase < 0.12 ? Math.sin((phase / 0.12) * Math.PI) : 0;
}

export type IntroLayout = {
  width: number;
  height: number;
  /** Mascot height in CSS px. */
  mascot: number;
  /** Feet-to-hands distance in CSS px (fallback only; the 3D scene measures the real hands). */
  gripOffset: number;
};

export type IntroState = {
  /** Screen y (CSS px) of the mascot's feet. */
  feet: number;
  /** Turn around the vertical axis: π = seen exactly from behind. */
  turn: number;
  /** Logo/claim on the curtain. */
  brandOpacity: number;
  pose: MascotPose;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

/** Steps per second (two steps per walk cycle). */
const CADENCE = 2.6;

export function mascotSize(width: number, height: number): number {
  return Math.round(Math.min(380, Math.max(180, Math.min(height * 0.34, width * 0.58))));
}

export function introAt(t: number, l: IntroLayout, blink: number): IntroState {
  const { height: h, mascot } = l;
  const start = mascot * 1.02 + h * 0.04;
  const end = h + mascot + 48;

  // Entry: from above the top edge to the first standing point.
  const enter = easeOutCubic(span(t, 0, 0.55));
  // Walk: mostly steady, gently easing in and out, with a small surge on every step.
  const u = span(t, 0.45, INTRO_DURATION);
  const travel = 0.55 * u + 0.45 * easeInOutSine(u);
  const walkAmount = easeOutCubic(span(t, 0.3, 0.75)) * (1 - 0.3 * span(t, 2.9, INTRO_DURATION));
  const phase = Math.PI * CADENCE * Math.max(0, t - 0.3);
  const surge = 7 * Math.max(0, Math.sin(2 * phase)) * walkAmount;

  const entryFeet = -mascot * 0.1 + (start + mascot * 0.1) * enter;
  const feet = t < 0.45 ? entryFeet : start + (end - start) * travel + surge;

  return {
    feet,
    turn: Math.PI + 0.1 * Math.sin(phase * 0.5) * walkAmount,
    brandOpacity: easeOutCubic(span(t, 0.05, 0.5)),
    pose: {
      grip: 0,
      wave: 0,
      swing: 0,
      kick: 0,
      stretch: 1 - 0.04 * Math.abs(Math.sin(phase)) * walkAmount,
      lookX: 0,
      lookY: 0,
      blink,
      drag: 1,
      walk: phase,
      walkAmount,
      time: t,
    },
  };
}
