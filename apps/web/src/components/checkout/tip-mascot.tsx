"use client";

import { cn } from "@/lib/cn";

/**
 * The mascot as the rider, next to the tip choice: it reacts to the amount. Eight frames rendered
 * from the 3D model (idle, blink, hop, four waving, squash) in one small strip; the file name carries
 * its content hash because the service worker keeps /brand/ files forever.
 */
export const TIP_MASCOT_SPRITE = "/brand/tip-mascot.5991279617.webp";

type Mood = 0 | 1 | 2 | 3;

const LINES: Record<Mood, string> = {
  0: "Nessun problema, buon appetito!",
  1: "Grazie! Arrivo di corsa",
  2: "Wow, grazie mille!",
  3: "Sei il top! Ti porto tutto caldissimo",
};

/** 0: no tip · 1: the smallest option · 2: a middle one · 3: the biggest (or more). */
export function tipMood(cents: number, options: number[]): Mood {
  const paid = options.filter((c) => c > 0).sort((a, b) => a - b);
  if (cents <= 0 || !paid.length) return 0;
  if (cents >= paid[paid.length - 1]!) return 3;
  if (cents > paid[0]!) return 2;
  return 1;
}

export function TipMascot({ mood, className }: { mood: Mood; className?: string }) {
  return (
    <div className={cn("tipm", className)} data-mood={mood}>
      <style>{CSS}</style>
      {/* Keyed by mood: each change replays the hop and the bubble's pop. */}
      <div key={`m${mood}`} className="tipm-figure" aria-hidden>
        <span className="tipm-shadow" />
        <span className="tipm-sprite" style={{ backgroundImage: `url(${TIP_MASCOT_SPRITE})` }} />
        {mood >= 2 ? (
          <span className="tipm-hearts">
            {Array.from({ length: mood === 3 ? 5 : 3 }, (_, i) => (
              <svg key={i} viewBox="0 0 24 24" style={{ "--h": i } as React.CSSProperties}>
                <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 5 6.4 5c2 0 3.6 1.1 4.6 2.6C12 6.1 13.6 5 15.6 5 19 5 21.1 8.5 19.6 11.8 17.5 16.4 12 21 12 21z" />
              </svg>
            ))}
          </span>
        ) : null}
      </div>
      <p key={`b${mood}`} className="tipm-bubble" aria-live="polite">
        {LINES[mood]}
      </p>
    </div>
  );
}

// Frame size in the strip (174 × 194) scaled to the figure; frames: 0 idle, 1 blink, 2 hop,
// 3–6 wave, 7 squash.
const CSS = `
.tipm{display:flex;align-items:center;gap:12px;min-width:0}
.tipm-figure{position:relative;flex:none;width:90px;height:100px}
.tipm-sprite{position:absolute;inset:0;background-repeat:no-repeat;background-size:800% 100%;background-position:0 0;
  animation:tipm-blink 4.2s step-end infinite;transform-origin:50% 100%}
.tipm-shadow{position:absolute;left:18%;right:18%;bottom:1px;height:7px;border-radius:50%;background:rgba(60,30,10,.16);filter:blur(2px)}
.tipm[data-mood="1"] .tipm-sprite,.tipm[data-mood="2"] .tipm-sprite,.tipm[data-mood="3"] .tipm-sprite{
  animation:tipm-hop .62s cubic-bezier(.3,1.4,.5,1) both,tipm-blink 4.2s step-end 1.6s infinite,tipm-wave .5s steps(4) .1s 3 backwards}
.tipm[data-mood="3"] .tipm-sprite{animation:tipm-hop .62s cubic-bezier(.3,1.4,.5,1) both,tipm-wave .45s steps(4) .1s infinite both}
@keyframes tipm-blink{0%{background-position:0 0}93%{background-position:14.2857% 0}97%{background-position:0 0}}
@keyframes tipm-wave{from{background-position:42.857% 0}to{background-position:100% 0}}
@keyframes tipm-hop{0%{transform:translateY(0) scale(1.06,.9)}35%{transform:translateY(-16px) scale(.95,1.06)}70%{transform:translateY(0) scale(1.05,.94)}100%{transform:none}}
.tipm-hearts{position:absolute;left:50%;top:6px;width:0;height:0}
.tipm-hearts svg{position:absolute;width:14px;height:14px;fill:#e2574c;opacity:0;
  animation:tipm-heart 1.6s cubic-bezier(.2,.7,.2,1) calc(var(--h) * .18s + .15s) both}
.tipm[data-mood="3"] .tipm-hearts svg{animation-iteration-count:infinite;animation-duration:2.2s}
.tipm-hearts svg:nth-child(odd){--dx:-26px}.tipm-hearts svg:nth-child(even){--dx:24px}.tipm-hearts svg:nth-child(3){--dx:-4px}
@keyframes tipm-heart{0%{opacity:0;transform:translate(-50%,10px) scale(.4)}20%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx,0px)),-46px) scale(1.1) rotate(12deg)}}
.tipm-bubble{position:relative;margin:0;padding:9px 13px;border-radius:16px;background:var(--color-surface,#fff);
  box-shadow:0 0 0 1px var(--color-line,rgba(0,0,0,.08)),0 8px 18px -12px rgba(0,0,0,.35);
  font-size:14px;font-weight:700;line-height:1.3;max-width:240px;animation:tipm-pop .4s cubic-bezier(.3,1.5,.5,1) both}
.tipm-bubble::before{content:"";position:absolute;left:-6px;top:50%;width:12px;height:12px;background:inherit;
  transform:translateY(-50%) rotate(45deg);box-shadow:-1px 1px 0 0 var(--color-line,rgba(0,0,0,.08));border-radius:2px}
@keyframes tipm-pop{from{opacity:0;transform:scale(.85) translateX(-6px)}to{opacity:1;transform:none}}
@media (max-width:380px){.tipm-figure{width:74px;height:82px}.tipm-bubble{font-size:13px}}
@media (prefers-reduced-motion:reduce){.tipm-sprite,.tipm-hearts svg,.tipm-bubble{animation:none!important}.tipm-hearts{display:none}}
`;
