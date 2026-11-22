"use client";

import { gsap } from "gsap";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";


/*
 * Dish Orbit Carousel, the hero of /scopri. The plated dish sits on the left; changing dish swings
 * it out over the top on a wide orbit while the next plate swings in from the other side. The
 * two-weight title wipes out and back in (thin line from the right, heavy line from the left), the
 * card with the price badge cross-fades, and a band behind the scene turns and takes the dish's
 * colour. Dishes change sideways only — swipe or drag left/right, a sideways trackpad scroll, the
 * arrows, thumbnails, side pager and arrow keys — while scrolling down always moves on to the next
 * section of the page. Phones get a one-screen stacked layout.
 */

export type OrbitDish = {
  /** Thin first title line (the category, e.g. "Ravioli al vapore"). */
  title: string;
  /** Heavy second title line (the filling, e.g. "Gamberi"). */
  subtitle: string;
  image: string;
  alt: string;
  eyebrow: string;
  /** Full product name and its Chinese name, in the card. */
  name: string;
  nameZh: string | null;
  price: string;
  description: string;
  ingredients: string[];
  /** Badge and band colour (hex). */
  accent: string;
  href: string;
  menuHref: string;
};

// #region geometry (from the reference design)
export function wrapIndex(i: number, n: number): number {
  if (n <= 0) return 0;
  return ((Math.round(i) % n) + n) % n;
}

/** Which way to swing when jumping from one dish to another: the shorter way round. */
export function stepDirection(from: number, to: number, n: number): 1 | -1 {
  if (n <= 0) return 1;
  const fwd = (((to - from) % n) + n) % n;
  return fwd <= n - fwd ? 1 : -1;
}

export function stripStart(index: number, n: number, visible: number): number {
  if (n <= visible) return 0;
  return Math.max(0, Math.min(index - 1, n - visible));
}

/** Title font size so a line of `chars` characters fits `width` px at `em` average glyph width. */
export function fitSize(chars: number, max: number, width: number, em: number): number {
  return Math.min(max, width / (Math.max(1, chars) * em));
}

/** The band: a thick stroke along the plates' orbit, tapering at both ends (degrees, screen space). */
export function arcPath(
  a0: number,
  a1: number,
  cx: number,
  cy: number,
  r: number,
  w: number,
  steps = 48,
): string {
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    const h = (w / 2) * Math.pow(Math.sin(Math.PI * t), 0.45);
    const c = Math.cos(a);
    const s = Math.sin(a);
    outer.push((cx + c * (r + h)).toFixed(1) + " " + (cy + s * (r + h)).toFixed(1));
    inner.push((cx + c * (r - h)).toFixed(1) + " " + (cy + s * (r - h)).toFixed(1));
  }
  return "M" + outer.join("L") + "L" + inner.reverse().join("L") + "Z";
}

const ARC_REST = [
  [50, 98],
  [46, 124],
  [60, 126],
  [40, 100],
];
const arcRest = (i: number) => ARC_REST[((i % ARC_REST.length) + ARC_REST.length) % ARC_REST.length]!;
const ARC_SWEEP = [38, 146];
// #endregion

const ORBIT_X = 299;
const ORBIT_Y = -450;
const ORBIT_R = 650;
const SWING = 50;
const ITEM = 118;
const VISIBLE = 4;

const CSS =
  ".dsh-trk{position:relative;width:100%}" +
  ".dsh-root{--bg:#faf7ef;--fg:#24221f;--muted:#766e64;--primary:#c6262e;position:relative;overflow:hidden;width:100%;touch-action:pan-y;background:var(--bg);color:var(--fg);" +
  "font-family:var(--font-archivo),ui-sans-serif,system-ui,sans-serif;container-type:inline-size;-webkit-tap-highlight-color:transparent;outline:none}" +
  ".dsh-root *{box-sizing:border-box}" +
  ".dsh-root:focus-visible{box-shadow:inset 0 0 0 2px var(--primary)}" +
  ".dsh-canvas{position:absolute;left:50%;top:50%;width:960px;height:520px;transform:translate(calc(-50% + var(--dsh-dx,0px)),calc(-50% + var(--dsh-dy,0px))) scale(var(--dsh-s,1));transform-origin:50% 50%}" +
  ".dsh-arc{position:absolute;left:0;top:0;width:960px;height:520px;overflow:visible;pointer-events:none}" +
  ".dsh-btn{appearance:none;border:0;background:none;color:inherit;font:inherit;padding:0;margin:0;cursor:pointer}" +
  ".dsh-btn:focus-visible{outline:2px solid var(--primary);outline-offset:3px;border-radius:10px}" +
  ".dsh-ico{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}" +
  ".dsh-brand{position:absolute;left:130px;top:40px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--primary)}" +
  ".dsh-pager{position:absolute;left:76px;top:150px;display:flex;flex-direction:column;align-items:center;gap:7px}" +
  ".dsh-dot{width:14px;height:10px;display:grid;place-items:center;transition:height .45s cubic-bezier(.3,.7,.2,1)}" +
  ".dsh-dot i{display:block;width:3px;height:3px;border-radius:3px;background:var(--fg);opacity:.45;transition:height .45s cubic-bezier(.3,.7,.2,1),opacity .3s}" +
  ".dsh-dot[aria-current] i{height:22px;opacity:.9}" +
  ".dsh-dot[aria-current]{height:26px}" +
  ".dsh-plates{position:absolute;left:130px;top:82px;width:245px;height:245px;touch-action:pan-y}" +
  ".dsh-orbit{position:absolute;inset:0;transform-origin:69% -217%;visibility:hidden;will-change:transform}" +
  // The photos are top-down cutouts (the dish already has its plate or basket): no frame, no shadow.
  ".dsh-plate{display:block;width:245px;height:245px}" +
  ".dsh-plate img{width:100%;height:100%;max-width:none;object-fit:contain;user-select:none;-webkit-user-drag:none}" +
  ".dsh-head{position:absolute;left:400px;top:96px;width:300px;height:150px}" +
  ".dsh-hd{position:absolute;inset:0;visibility:hidden}" +
  ".dsh-eye{font-size:12.5px;font-weight:600;letter-spacing:.01em;margin:0 0 4px 2px;color:var(--primary)}" +
  ".dsh-t1,.dsh-t2{display:block;white-space:nowrap;line-height:1;text-transform:uppercase;margin:0}" +
  ".dsh-t1{font-weight:300;letter-spacing:-.015em;margin-top:6px}" +
  ".dsh-t2{font-weight:900;letter-spacing:-.03em;margin-top:6px;color:color-mix(in oklab,var(--fg) 90%,transparent)}" +
  ".dsh-acts{position:absolute;left:404px;top:280px;display:flex;gap:36px;font-size:13px;font-weight:600}" +
  ".dsh-acts a{display:flex;align-items:center;gap:9px;padding:4px 0;color:inherit;text-decoration:none}" +
  ".dsh-acts a:hover{color:var(--primary)}" +
  ".dsh-acts .dsh-ico{width:14px;height:14px}" +
  ".dsh-card{position:absolute;left:722px;top:118px;width:223px;padding:18px 20px 20px;border-radius:20px;" +
  "background:color-mix(in oklab,#fff 78%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);" +
  "box-shadow:0 1px 0 rgba(0,0,0,.04) inset,0 18px 40px -24px rgba(0,0,0,.3)}" +
  ".dsh-tabs{display:flex;justify-content:space-between;padding:0 6px;font-size:12px;margin-bottom:18px}" +
  // Tabs: the red underline passes from one tab to the other (each grows from the side facing
  // the other), and the panel below slides in; ingredients pop in one after another.
  ".dsh-tab{position:relative;color:var(--muted);font-weight:500;padding:3px 0;transition:color .3s}" +
  ".dsh-tab::after{content:'';position:absolute;left:0;right:0;bottom:-2px;height:2px;border-radius:2px;background:var(--primary);transform:scaleX(0);transition:transform .38s cubic-bezier(.65,0,.35,1)}" +
  ".dsh-tab:first-child::after{transform-origin:100% 50%}" +
  ".dsh-tab:last-child::after{transform-origin:0 50%}" +
  ".dsh-tab[aria-selected=true]{color:var(--fg);font-weight:700}" +
  ".dsh-tab[aria-selected=true]::after{transform:scaleX(1)}" +
  ".dsh-tab:hover{color:var(--fg)}" +
  "@keyframes dsh-pane{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}" +
  "@keyframes dsh-chip{from{opacity:0;transform:translateY(8px) scale(.85)}to{opacity:1;transform:none}}" +
  ".dsh-pane{animation:dsh-pane .45s cubic-bezier(.2,.7,.2,1) both}" +
  ".dsh-pane .dsh-ing li{animation:dsh-chip .4s cubic-bezier(.3,1.4,.5,1) both;animation-delay:calc(var(--i,0) * 45ms + 80ms)}" +
  ".dsh-bodies{display:grid}" +
  ".dsh-body{grid-area:1/1;visibility:hidden}" +
  ".dsh-rate{display:flex;align-items:center;gap:10px;margin:0 0 12px}" +
  ".dsh-badge{display:grid;place-items:center;min-width:76px;height:40px;padding:0 10px;border-radius:12px;font-size:19px;font-weight:800;letter-spacing:-.02em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.25)}" +
  ".dsh-zh{font-family:'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif;font-size:14px;color:var(--muted)}" +
  ".dsh-name{font-size:16px;font-weight:700;letter-spacing:-.01em;line-height:1.2;margin:0 0 8px}" +
  ".dsh-desc{font-size:12.5px;line-height:1.4;margin:0;min-height:52px;color:color-mix(in oklab,var(--fg) 82%,transparent)}" +
  ".dsh-ing{display:flex;flex-wrap:wrap;gap:5px;margin:0;padding:0;list-style:none;min-height:52px}" +
  ".dsh-ing li{font-size:11px;padding:4px 9px;border-radius:99px;background:rgba(0,0,0,.06)}" +
  ".dsh-cta{display:flex;align-items:center;justify-content:center;gap:8px;height:40px;margin-top:16px;border-radius:99px;background:var(--primary);color:#fff;font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 10px 20px -10px rgba(198,38,46,.7)}" +
  ".dsh-cta:hover{background:#a81d24}" +
  ".dsh-strip{position:absolute;left:130px;top:362px;width:550px;height:122px;display:flex;align-items:center}" +
  ".dsh-arrow{width:36px;height:36px;display:grid;place-items:center;flex:none}" +
  ".dsh-arrow svg{width:12px;height:16px;fill:currentColor}" +
  ".dsh-win{position:relative;width:" +
  ITEM * VISIBLE +
  "px;height:122px;overflow:hidden;flex:none;margin:0 2px;" +
  "-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}" +
  ".dsh-track{position:absolute;left:0;top:0;display:flex;transition:transform .6s cubic-bezier(.65,0,.35,1)}" +
  ".dsh-th{width:" +
  ITEM +
  "px;height:122px;display:flex;justify-content:center;padding-top:3px}" +
  ".dsh-th .dsh-btn{width:84px;height:116px;border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:7px;padding-top:9px;transition:background .45s}" +
  ".dsh-th .dsh-btn[aria-current]{background:rgba(255,255,255,.75);box-shadow:0 10px 24px -16px rgba(0,0,0,.3)}" +
  ".dsh-th img{width:56px;height:56px;max-width:none;object-fit:contain;transition:transform .45s}" +
  ".dsh-th .dsh-btn[aria-current] img{transform:scale(1.06)}" +
  ".dsh-th span{font-size:10px;line-height:1.25;text-align:center;font-weight:600;color:color-mix(in oklab,var(--fg) 78%,transparent);max-width:80px}" +
  ".dsh-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}" +
  "@container (max-width:719px){" +
  ".dsh-canvas{position:relative;left:auto;top:auto;width:100%;height:100%;transform:none;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 16px calc(14px + env(safe-area-inset-bottom))}" +
  ".dsh-arc{width:200%;height:auto;left:-60%;top:-40px}" +
  ".dsh-brand{display:none}" +
  ".dsh-pager{left:12px;top:50%;transform:translateY(-50%)}" +
  ".dsh-plates{position:relative;left:auto;top:auto;width:min(56vw,30svh);height:min(56vw,30svh);flex:none}" +
  ".dsh-plate{width:100%;height:100%}" +
  ".dsh-head{position:relative;left:auto;top:auto;width:100%;height:118px;margin-top:16px;flex:none}" +
  ".dsh-hd{text-align:center;transform:scale(.8);transform-origin:50% 0}" +
  ".dsh-acts{position:relative;left:auto;top:auto;margin-top:6px;gap:28px;flex:none}" +
  ".dsh-card{position:relative;left:auto;top:auto;width:100%;max-width:420px;margin-top:12px;padding:14px 16px 16px;flex:none}" +
  ".dsh-tabs{margin-bottom:12px}" +
  ".dsh-desc,.dsh-ing{min-height:0}" +
  ".dsh-cta{margin-top:12px}" +
  ".dsh-strip{display:none}" +
  "}" +
  "@container (max-width:719px) and (max-height:700px){.dsh-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.dsh-head{height:104px;margin-top:10px}}" +
  "@media (prefers-reduced-motion:reduce){.dsh-track,.dsh-dot,.dsh-dot i,.dsh-th .dsh-btn,.dsh-th img,.dsh-tab::after{transition:none}.dsh-pane,.dsh-pane .dsh-ing li{animation:none}}";

const HIDE_1 = "inset(0% 0% 0% 100%)";
const HIDE_2 = "inset(0% 100% 0% 0%)";
const SHOW = "inset(0% 0% 0% 0%)";

const Icon = {
  menu: (
    <svg className="dsh-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  ),
  order: (
    <svg className="dsh-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0" />
    </svg>
  ),
};

export function DishOrbitCarousel({ dishes, height = "100svh" }: { dishes: OrbitDish[]; height?: string }) {
  const n = dishes.length;
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<"descrizione" | "ingredienti">("descrizione");

  const trackRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const indexRef = useRef(0);
  const orbits = useRef<(HTMLDivElement | null)[]>([]);
  const heads = useRef<(HTMLDivElement | null)[]>([]);
  const bodies = useRef<(HTMLDivElement | null)[]>([]);
  const arcRef = useRef<SVGPathElement | null>(null);
  const arc = useRef({ a0: 0, a1: 0 });
  const shown = useRef(-1);
  const dirRef = useRef<1 | -1>(1);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const reducedRef = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const wheelAt = useRef(0);

  // Fit the 960 × 520 design canvas to the stage (desktop and tablet), centring what is actually
  // drawn — side pager (x 76) to the card's right edge (x 945), label (y 40) to the thumbnails
  // (y 481) — rather than the canvas, whose margins are uneven.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      const s = Math.min(el.clientWidth / 960, el.clientHeight / 520, 1.6);
      el.style.setProperty("--dsh-s", String(s));
      el.style.setProperty("--dsh-dx", `${((960 - (76 + 945)) / 2) * s}px`);
      el.style.setProperty("--dsh-dy", `${((520 - (40 + 481)) / 2) * s}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Titles are measured, never estimated: each line shrinks until it fits the title column (so it
  // can never run under the card), and a line that would get too small wraps onto two lines.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const fitTitles = () => {
      for (const head of heads.current) {
        const avail = head?.clientWidth ?? 0;
        if (!head || !avail) continue;
        head.querySelectorAll<HTMLElement>("[data-fit]").forEach((line) => {
          const max = Number(line.dataset.fit);
          const min = Number(line.dataset.min ?? 18);
          line.style.whiteSpace = "nowrap";
          line.style.lineHeight = "";
          line.style.fontSize = `${max}px`;
          const width = line.scrollWidth;
          let size = width > avail ? Math.floor(max * (avail / width) * 0.96) : max;
          if (size < min) {
            // Too small on one line: two (or, for very long names, three) lines at a readable size.
            for (const n of [2, 3]) {
              size = Math.max(16, Math.min(max, Math.floor(max * ((n * avail) / width) * 0.82)));
              if (size >= min * 0.8) break;
            }
            line.style.whiteSpace = "normal";
            line.style.lineHeight = "1.02";
          }
          line.style.fontSize = `${size}px`;
          // A single long word could still overflow: shrink until the box holds it.
          while (line.scrollWidth > avail + 1 && size > 14) {
            size -= 1;
            line.style.fontSize = `${size}px`;
          }
        });
        // Height too: the title never spills onto the buttons below (measured as drawn, so the
        // phone layout's scale-down counts).
        const lines = [...head.querySelectorAll<HTMLElement>("[data-fit]")].reverse();
        const bottom = () =>
          (lines[0]?.getBoundingClientRect().bottom ?? 0) - head.getBoundingClientRect().top;
        const room = head.parentElement!.getBoundingClientRect().height;
        for (let guard = 0; guard < 60 && bottom() > room - 4; guard++) {
          for (const line of lines) {
            const size = parseFloat(line.style.fontSize) - 1;
            if (size >= 14) line.style.fontSize = `${size}px`;
          }
        }
      }
    };
    fitTitles();
    void document.fonts?.ready.then(fitTitles);
    const ro = new ResizeObserver(fitTitles);
    ro.observe(root);
    return () => ro.disconnect();
  }, [dishes]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => (reducedRef.current = mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // The swap: every dish is in the DOM; GSAP only moves the outgoing and incoming ones.
  useLayoutEffect(() => {
    const from = shown.current;
    const to = index;
    const parts = (i: number) => {
      const head = heads.current[i];
      return {
        orbit: orbits.current[i] ?? null,
        head: head ?? null,
        eye: head?.querySelector(".dsh-eye") ?? null,
        t1: head?.querySelector(".dsh-t1") ?? null,
        t2: head?.querySelector(".dsh-t2") ?? null,
        body: bodies.current[i] ?? null,
      };
    };
    const drawArc = () =>
      arcRef.current?.setAttribute(
        "d",
        arcPath(arc.current.a0, arc.current.a1, ORBIT_X, ORBIT_Y, ORBIT_R, 118),
      );
    const rest = arcRest(to);
    const tint = dishes[to]?.accent ?? "transparent";
    if (tlRef.current) tlRef.current.progress(1).kill();
    const b = parts(to);
    if (from === -1 || from === to || reducedRef.current) {
      for (let i = 0; i < n; i++)
        if (i !== to) {
          const p = parts(i);
          gsap.set([p.orbit, p.head, p.body].filter(Boolean), { autoAlpha: 0 });
        }
      gsap.set([b.orbit, b.head, b.body, b.eye].filter(Boolean), { autoAlpha: 1, rotation: 0, y: 0 });
      if (b.t1) gsap.set(b.t1, { clipPath: SHOW });
      if (b.t2) gsap.set(b.t2, { clipPath: SHOW });
      arc.current.a0 = rest[0]!;
      arc.current.a1 = rest[1]!;
      drawArc();
      if (arcRef.current) gsap.set(arcRef.current, { fill: tint });
      shown.current = to;
      return;
    }
    const a = parts(from);
    const d = dirRef.current;
    const tl = gsap.timeline({
      onComplete: () => {
        tlRef.current = null;
      },
    });
    tlRef.current = tl;
    // Plate: out over the top on the orbit, the next one swings in from the far side.
    tl.to(a.orbit, { rotation: SWING * d, duration: 0.62, ease: "power2.in" }, 0)
      .set(a.orbit, { autoAlpha: 0, rotation: 0 }, 0.62)
      .fromTo(
        b.orbit,
        { autoAlpha: 1, rotation: -SWING * d },
        { rotation: 0, duration: 0.95, ease: "power3.out" },
        0.3,
      );
    // Title: thin line clips away to the right, heavy line to the left, then the next wipes in.
    tl.to(a.t1, { clipPath: HIDE_1, duration: 0.42, ease: "power2.in" }, 0)
      .to(a.t2, { clipPath: HIDE_2, duration: 0.42, ease: "power2.in" }, 0.06)
      .to(a.eye, { autoAlpha: 0, duration: 0.25 }, 0)
      .set(a.head, { autoAlpha: 0 }, 0.5)
      .set(b.head, { autoAlpha: 1 }, 0.5)
      .fromTo(b.eye, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, 0.55)
      .fromTo(b.t1, { clipPath: HIDE_1 }, { clipPath: SHOW, duration: 0.7, ease: "power3.out" }, 0.55)
      .fromTo(b.t2, { clipPath: HIDE_2 }, { clipPath: SHOW, duration: 0.7, ease: "power3.out" }, 0.62);
    // Card: cross-fade, the incoming rows rise in turn.
    tl.to(a.body, { autoAlpha: 0, y: -6, duration: 0.3, ease: "power1.in" }, 0.05).set(
      b.body,
      { autoAlpha: 1, y: 0 },
      0.4,
    );
    if (b.body)
      tl.fromTo(
        b.body.children,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" },
        0.4,
      );
    // The band stretches along the orbit with the plates, then settles, morphing colour.
    tl.to(
      arc.current,
      { a0: ARC_SWEEP[0], a1: ARC_SWEEP[1], duration: 0.6, ease: "power2.inOut", onUpdate: drawArc },
      0,
    ).to(
      arc.current,
      { a0: rest[0], a1: rest[1], duration: 0.85, ease: "power3.out", onUpdate: drawArc },
      0.6,
    );
    if (arcRef.current) tl.to(arcRef.current, { fill: tint, duration: 1.1, ease: "power1.inOut" }, 0.1);
    shown.current = to;
  }, [index, n, dishes]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
    },
    [],
  );

  const select = (next: number, dir: 1 | -1) => {
    if (next === indexRef.current) return;
    dirRef.current = dir;
    indexRef.current = next;
    setIndex(next);
  };

  const go = (to: number, dir?: 1 | -1) => {
    if (n < 2) return;
    const next = wrapIndex(to, n);
    if (next === index) return;
    select(next, dir ?? stepDirection(index, next, n));
  };
  const step = (d: 1 | -1) => go(index + d, d);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.4) step(dx < 0 ? 1 : -1);
  };
  // Two-finger sideways scroll on a trackpad (or shift + wheel): one dish per gesture. Vertical
  // wheel is left alone, so the page scrolls on.
  const onWheel = (e: React.WheelEvent) => {
    const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
    if (Math.abs(dx) < 18 || Math.abs(dx) < Math.abs(e.deltaY) * (e.shiftKey ? 0 : 1.2)) return;
    const t = e.timeStamp;
    if (t - wheelAt.current < 650) {
      wheelAt.current = t;
      return;
    }
    wheelAt.current = t;
    step(dx > 0 ? 1 : -1);
  };

  const start = stripStart(index, n, VISIBLE);
  const dish = dishes[index];

  return (
    <div
      ref={trackRef}
      className="dsh-trk"
      style={{ height }}
    >
      <div
        ref={rootRef}
        className="dsh-root"
        style={{ height }}
        role="region"
        aria-roledescription="carosello"
        aria-label="Le specialità DIMSUM"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
        onWheel={onWheel}
      >
        <style>{CSS}</style>
        <div className="dsh-canvas">
          <svg className="dsh-arc" viewBox="0 0 960 520" aria-hidden="true">
            <path ref={arcRef} style={{ opacity: 0.34 }} />
          </svg>

          <p className="dsh-brand">DIMSUM · Le specialità</p>

          <div className="dsh-pager" role="tablist" aria-label="Scegli un piatto">
            {dishes.map((d, i) => (
              <button
                key={d.href}
                type="button"
                role="tab"
                className="dsh-btn dsh-dot"
                aria-selected={i === index}
                aria-current={i === index ? "true" : undefined}
                aria-label={d.name}
                onClick={() => go(i)}
              >
                <i />
              </button>
            ))}
          </div>

          <div
            className="dsh-plates"
          >
            {dishes.map((d, i) => (
              <div
                key={d.href}
                ref={(el) => {
                  orbits.current[i] = el;
                }}
                className="dsh-orbit"
                aria-hidden={i !== index}
              >
                <div className="dsh-plate">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.image}
                    alt={d.alt}
                    width={760}
                    height={760}
                    draggable={false}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="dsh-head" aria-live="polite">
            {dishes.map((d, i) => (
              <div
                key={d.href}
                ref={(el) => {
                  heads.current[i] = el;
                }}
                className="dsh-hd"
                aria-hidden={i !== index}
              >
                <p className="dsh-eye">{d.eyebrow}</p>
                <h2 style={{ margin: 0, font: "inherit" }}>
                  <span
                    className="dsh-t1"
                    data-fit={44}
                    data-min={26}
                    style={{ fontSize: fitSize(d.title.length, 44, 300, 0.62) + "px" }}
                  >
                    {d.title}
                  </span>
                  <span
                    className="dsh-t2"
                    data-fit={58}
                    data-min={32}
                    style={{ fontSize: fitSize(d.subtitle.length, 58, 300, 0.75) + "px" }}
                  >
                    {d.subtitle}
                  </span>
                </h2>
              </div>
            ))}
          </div>

          <div className="dsh-acts">
            <Link href={dish?.href ?? "/menu"}>{Icon.order}Ordina questo piatto</Link>
            <Link href={dish?.menuHref ?? "/menu"}>{Icon.menu}Tutto il menu</Link>
          </div>

          <div className="dsh-card">
            <div className="dsh-tabs" role="tablist" aria-label="Dettagli del piatto">
              {(["descrizione", "ingredienti"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  className="dsh-btn dsh-tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t === "descrizione" ? "Descrizione" : "Ingredienti"}
                </button>
              ))}
            </div>
            <div className="dsh-bodies">
              {dishes.map((d, i) => (
                <div
                  key={d.href}
                  ref={(el) => {
                    bodies.current[i] = el;
                  }}
                  className="dsh-body"
                  aria-hidden={i !== index}
                >
                  <div className="dsh-rate">
                    <span className="dsh-badge" style={{ background: d.accent }}>
                      {d.price}
                    </span>
                    {d.nameZh ? <span className="dsh-zh">{d.nameZh}</span> : null}
                  </div>
                  <p className="dsh-name">{d.name}</p>
                  {/* Keyed by tab: switching remounts the panel, which plays its entrance. */}
                  <div key={tab} className="dsh-pane">
                    {tab === "descrizione" || !d.ingredients.length ? (
                      <p className="dsh-desc">{d.description}</p>
                    ) : (
                      <ul className="dsh-ing">
                        {d.ingredients.map((x, k) => (
                          <li key={x} style={{ "--i": k } as React.CSSProperties}>
                            {x}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Link className="dsh-cta" href={d.href} tabIndex={i === index ? 0 : -1}>
                    Ordina ora
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="dsh-strip">
            <button
              type="button"
              className="dsh-btn dsh-arrow"
              aria-label="Piatto precedente"
              onClick={() => step(-1)}
            >
              <svg viewBox="0 0 12 16" aria-hidden="true">
                <path d="M11 0v16L0 8z" />
              </svg>
            </button>
            <div className="dsh-win">
              <div className="dsh-track" style={{ transform: `translateX(${-start * ITEM}px)` }}>
                {dishes.map((d, i) => (
                  <div key={d.href} className="dsh-th">
                    <button
                      type="button"
                      className="dsh-btn"
                      aria-current={i === index ? "true" : undefined}
                      onClick={() => go(i)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.image} alt="" width={56} height={56} draggable={false} loading="lazy" />
                      <span>{d.title}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="dsh-btn dsh-arrow"
              aria-label="Piatto successivo"
              onClick={() => step(1)}
            >
              <svg viewBox="0 0 12 16" aria-hidden="true">
                <path d="M1 0v16l11-8z" />
              </svg>
            </button>
          </div>
        </div>
        <p className="dsh-sr" aria-live="polite">
          {dish ? `Piatto ${index + 1} di ${n}: ${dish.name}` : ""}
        </p>
      </div>
    </div>
  );
}
