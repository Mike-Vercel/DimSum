"use client";

import { MessageCircle } from "lucide-react";
import { TIP_MASCOT_SPRITE } from "@/components/checkout/tip-mascot";
import { openAssistant } from "./assistant";

/** The mascot in the footer: waves at you and opens Dim, the assistant. */
export function FooterMascot() {
  return (
    <div className="fm">
      <style>{CSS}</style>
      <button type="button" className="fm-figure" onClick={() => openAssistant()} aria-label="Parla con Dim">
        <span className="fm-shadow" aria-hidden />
        <span className="fm-sprite" style={{ backgroundImage: `url(${TIP_MASCOT_SPRITE})` }} aria-hidden />
      </button>
      <div className="fm-copy">
        <p className="fm-bubble">
          Ciao! Sono <strong>Dim</strong> 🥟 Hai un dubbio, un&apos;allergia o non sai cosa ordinare? Chiedimi!
        </p>
        <button type="button" className="fm-cta" onClick={() => openAssistant()}>
          <MessageCircle className="size-4" aria-hidden /> Parla con Dim
        </button>
      </div>
    </div>
  );
}

const CSS = `
.fm{display:flex;align-items:center;gap:14px}
.fm-figure{position:relative;flex:none;width:104px;height:116px;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.fm-sprite{position:absolute;inset:0;background-repeat:no-repeat;background-size:800% 100%;background-position:0 0;transform-origin:50% 100%;
  animation:fm-wave 5s steps(1) infinite,fm-bob 5s ease-in-out infinite}
.fm-figure:hover .fm-sprite{animation:fm-wave-fast .5s steps(4) infinite,fm-bob 5s ease-in-out infinite}
.fm-shadow{position:absolute;left:22%;right:22%;bottom:2px;height:8px;border-radius:50%;background:rgba(0,0,0,.35);filter:blur(3px)}
@keyframes fm-wave{0%,40%{background-position:0 0}42%{background-position:42.857% 0}45%{background-position:57.143% 0}48%{background-position:71.429% 0}51%{background-position:85.714% 0}54%{background-position:42.857% 0}57%{background-position:57.143% 0}60%{background-position:71.429% 0}63%{background-position:85.714% 0}66%,90%{background-position:0 0}92%{background-position:14.2857% 0}95%,100%{background-position:0 0}}
@keyframes fm-wave-fast{from{background-position:42.857% 0}to{background-position:100% 0}}
@keyframes fm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.fm-copy{min-width:0}
/* More specific than the footer's paragraph style. */
.fm p.fm-bubble{position:relative;margin:0;padding:10px 14px;border-radius:16px;background:#fff;color:#1c1c1a;font-size:14px;line-height:1.45;max-width:30ch}
.fm p.fm-bubble strong{color:#c6262e}
.fm-bubble::before{content:"";position:absolute;left:-6px;top:22px;width:12px;height:12px;background:#fff;transform:rotate(45deg);border-radius:2px}
.fm-cta{display:inline-flex;align-items:center;gap:7px;margin-top:10px;padding:9px 15px;border-radius:999px;border:0;background:#c6262e;color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:transform .2s}
.fm-cta:hover{transform:translateY(-1px)}
@media (prefers-reduced-motion:reduce){.fm-sprite{animation:none!important}}
`;
