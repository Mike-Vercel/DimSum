/**
 * Haptic feedback abstraction. On the web it uses the Vibration API where available (Android);
 * the native app maps the same calls to expo-haptics, so components never depend on a platform.
 */
type Pattern = number | number[];

function vibrate(pattern: Pattern) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* not allowed before user activation */
  }
}

export const haptics = {
  tap: () => vibrate(6),
  select: () => vibrate(4),
  success: () => vibrate([10, 40, 14]),
  warning: () => vibrate([18, 60, 18]),
  error: () => vibrate([28, 50, 28, 50, 28]),
};
