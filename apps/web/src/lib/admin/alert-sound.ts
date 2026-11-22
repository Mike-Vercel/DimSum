"use client";

/**
 * New-order alerts synthesised with Web Audio (no audio files to download or cache).
 *
 * Browsers only allow sound after a user gesture: the kitchen board unlocks the audio on the first
 * tap anywhere and asks with a full-screen prompt until it is unlocked. Everything goes through a
 * compressor and a master gain, so the ringtone is loud and clear on tablet and phone speakers.
 */
let context: AudioContext | null = null;
let master: GainNode | null = null;

export type AlertSound = "ringtone" | "chime" | "bell" | "gong";

export function audioUnlocked(): boolean {
  return context?.state === "running";
}

function output(ctx: AudioContext): AudioNode {
  if (master) return master;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 8;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;
  master = ctx.createGain();
  master.gain.value = 1.6;
  master.connect(compressor).connect(ctx.destination);
  return master;
}

export async function unlockAudio(): Promise<boolean> {
  if (typeof window === "undefined" || !("AudioContext" in window)) return false;
  context ??= new AudioContext();
  if (context.state !== "running") await context.resume().catch(() => undefined);
  if (context.state === "running") {
    // A silent blip keeps iOS from suspending the context right after unlocking it.
    const osc = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(output(context));
    osc.start();
    osc.stop(context.currentTime + 0.05);
  }
  return context.state === "running";
}

type Note = { f: number; at: number; len: number };

/** A bright marimba-like phone ringtone: two quick phrases, about 1.6 s. */
const RINGTONE: Note[] = [
  { f: 1318.51, at: 0.0, len: 0.16 }, // E6
  { f: 987.77, at: 0.12, len: 0.16 }, // B5
  { f: 1318.51, at: 0.24, len: 0.16 },
  { f: 1661.22, at: 0.36, len: 0.28 }, // G#6
  { f: 1318.51, at: 0.8, len: 0.16 },
  { f: 987.77, at: 0.92, len: 0.16 },
  { f: 1318.51, at: 1.04, len: 0.16 },
  { f: 1975.53, at: 1.16, len: 0.42 }, // B6
];

const PATTERNS: Record<
  Exclude<AlertSound, "ringtone">,
  { notes: number[]; type: OscillatorType; step: number; decay: number }
> = {
  chime: { notes: [659.25, 830.61, 987.77, 1318.51], type: "triangle", step: 0.14, decay: 0.7 },
  bell: { notes: [1046.5, 1318.51, 1046.5, 1318.51], type: "sine", step: 0.22, decay: 0.9 },
  gong: { notes: [196, 261.63], type: "sine", step: 0.35, decay: 1.8 },
};

function tone(ctx: AudioContext, f: number, t: number, len: number, volume: number, type: OscillatorType) {
  const out = output(ctx);
  // Fundamental plus a soft octave: a "struck" bar, cutting through kitchen noise.
  for (const [mult, share, kind] of [
    [1, 1, type],
    [2, 0.35, "sine"],
    [3.98, 0.12, "sine"],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind;
    osc.frequency.value = f * mult;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume * share, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.25);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + len + 0.3);
  }
}

/** Plays one round of the alert. Returns false when the audio is still locked by the browser. */
export function playAlert(sound: AlertSound = "ringtone", volume = 0.5): boolean {
  if (!context || context.state !== "running") return false;
  const start = context.currentTime + 0.02;
  if (sound === "ringtone") {
    for (const n of RINGTONE) tone(context, n.f, start + n.at, n.len, volume, "triangle");
    return true;
  }
  const p = PATTERNS[sound] ?? PATTERNS.chime;
  p.notes.forEach((frequency, i) =>
    tone(context!, frequency, start + i * p.step, p.decay * 0.6, volume, p.type),
  );
  return true;
}

/** Seconds between the starts of two rounds while an order keeps ringing. */
export function ringInterval(sound: AlertSound): number {
  return sound === "ringtone" ? 2.2 : 2.5;
}
