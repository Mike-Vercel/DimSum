"use client";

/**
 * New-order alert synthesised with Web Audio (no audio files to download or cache). Browsers
 * only allow sound after a user gesture: the kitchen display asks once with "Attiva suoni".
 */
let context: AudioContext | null = null;

export type AlertSound = "chime" | "bell" | "gong";

export function audioUnlocked(): boolean {
  return context?.state === "running";
}

export async function unlockAudio(): Promise<boolean> {
  if (typeof window === "undefined" || !("AudioContext" in window)) return false;
  context ??= new AudioContext();
  if (context.state === "suspended") await context.resume().catch(() => undefined);
  return context.state === "running";
}

const PATTERNS: Record<AlertSound, { notes: number[]; type: OscillatorType; step: number; decay: number }> = {
  chime: { notes: [659.25, 830.61, 987.77, 1318.51], type: "triangle", step: 0.14, decay: 0.7 },
  bell: { notes: [1046.5, 1318.51, 1046.5, 1318.51], type: "sine", step: 0.22, decay: 0.9 },
  gong: { notes: [196, 261.63], type: "sine", step: 0.35, decay: 1.8 },
};

export function playAlert(sound: AlertSound = "chime", volume = 0.5): boolean {
  if (!context || context.state !== "running") return false;
  const p = PATTERNS[sound];
  const start = context.currentTime + 0.02;
  p.notes.forEach((frequency, i) => {
    const osc = context!.createOscillator();
    const gain = context!.createGain();
    osc.type = p.type;
    osc.frequency.value = frequency;
    const t = start + i * p.step;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
    osc.connect(gain).connect(context!.destination);
    osc.start(t);
    osc.stop(t + p.decay + 0.05);
  });
  return true;
}
