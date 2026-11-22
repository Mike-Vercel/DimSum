import type { MascotPose } from "@/components/mascot/rig";

/**
 * Opening choreography, in seconds:
 *   0.00–0.60  the mascot drops onto the dark curtain and lands with a squash;
 *   0.60–1.30  it waves while the page, hanging from a red hem bar, slides down from the top;
 *   1.30–1.50  it grabs the bar;
 *   1.50–2.45  it pulls the page all the way down, legs kicking, and rides off the bottom.
 */
export const INTRO_DURATION = 2.45;

/** Fraction of the mascot height between the feet and the gripping hands, for the 2D fallback. */
export const FALLBACK_GRIP_RATIO = 0.33;

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
  /** Feet-to-hands distance in CSS px. */
  gripOffset: number;
  /** Top safe area (notch) in CSS px. */
  safeTop: number;
};

export type IntroState = {
  edge: number;
  feet: number;
  barFront: number;
  turn: number;
  /** Logo/claim on the curtain. */
  brandOpacity: number;
  pose: MascotPose;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const easeInCubic = (x: number) => x ** 3;
const bell = (x: number) => Math.sin(Math.PI * clamp01(x));

export function mascotSize(width: number, height: number): number {
  return Math.round(Math.min(340, Math.max(170, Math.min(height * 0.36, width * 0.62))));
}

export function introAt(t: number, l: IntroLayout, blink: number): IntroState {
  const { height: h, mascot, gripOffset } = l;
  const feetStand = Math.min(h - 28, h * 0.58 + mascot * 0.42);
  const handStand = feetStand - gripOffset;

  // A. Drop and land.
  const fall = span(t, 0, 0.5);
  let feet = -12 + (feetStand + 12) * fall * fall;
  const landing = span(t, 0.48, 0.78);
  let stretch = t < 0.48 ? 1 + 0.12 * fall : 1 - 0.2 * bell(landing) * (1 - landing * 0.4);

  // B. Wave while the page slides down to the hands.
  const wave = bell(span(t, 0.62, 1.32)) > 0 ? Math.min(1, bell(span(t, 0.62, 1.32)) * 1.6) : 0;
  let edge = -16 + (handStand + 16) * easeOutCubic(span(t, 0.72, 1.3));

  // C. Grab: the bar comes forward into the hands, with a small anticipation squash.
  const grip = easeInOutCubic(span(t, 1.28, 1.48));
  const barFront = grip;
  stretch *= 1 - 0.06 * bell(span(t, 1.3, 1.6));

  // D. Pull the page down and ride off the bottom.
  const pull = easeInCubic(span(t, 1.5, INTRO_DURATION));
  const endEdge = h + mascot + 40;
  if (t > 1.5) {
    edge = handStand + (endEdge - handStand) * pull;
    feet = edge + gripOffset;
    stretch *= 1 + 0.07 * pull;
  }
  const pulling = span(t, 1.45, 1.7);
  const swing = 0.13 * Math.sin((t - 1.45) * 8.5) * pulling * (1 - 0.4 * pull);
  const kick = Math.sin(t * 13) * 0.85 * pulling;

  return {
    edge,
    feet,
    barFront,
    turn: 0.32 * bell(span(t, 0.5, 1.4)) * (1 - grip),
    brandOpacity: easeOutCubic(span(t, 0.05, 0.45)),
    pose: {
      grip,
      wave: wave * (1 - grip),
      swing,
      kick,
      stretch,
      lookX: 0.25 * bell(span(t, 0.6, 1.3)),
      lookY: t > 0.72 && t < 1.3 ? 0.22 * bell(span(t, 0.72, 1.3)) : -0.12 * pulling,
      blink,
      time: t,
    },
  };
}
