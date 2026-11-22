"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { aboveHemPath, belowHemPolygon, foldPaths, hemAt, hemPath, type HemInput } from "./cloth";
import { INTRO_SEEN_KEY as SEEN_KEY } from "./gate";
import type { IntroScene } from "./intro-scene";
import {
  blinkAt,
  FALLBACK_GRIP_RATIO,
  INTRO_DURATION,
  introAt,
  mascotSize,
  type IntroLayout,
} from "./timeline";

/** Longest wait for the 3D engine before the 2D version plays instead. */
const LOAD_BUDGET_MS = 2200;

function finish(root: HTMLElement | null) {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {}
  const html = document.documentElement;
  if (!root) {
    delete html.dataset.intro;
    return;
  }
  root.style.transition = "opacity 240ms ease-out";
  root.style.opacity = "0";
  window.setTimeout(() => delete html.dataset.intro, 250);
}

/**
 * Opening of the web app. The page comes down like a blanket: the DIMSUM mascot (3D), seen from
 * behind, holds its red hem with both hands and walks down the screen, pulling it. The hem sags
 * where it is held, the sides trail behind, folds gather towards the hands and the edge ripples
 * with every step, until the mascot walks off the bottom and the home is fully revealed.
 * Tap anywhere to skip. Without WebGL the same choreography plays with the 2D mascot.
 */
export function MascotIntro() {
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flatRef = useRef<HTMLImageElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clothClipRef = useRef<SVGPathElement>(null);
  const shadeRef = useRef<SVGPathElement>(null);
  const lightRef = useRef<SVGPathElement>(null);
  const bandRef = useRef<SVGPathElement>(null);
  const hemShadowRef = useRef<SVGPathElement>(null);
  const hemRef = useRef<SVGPathElement>(null);
  const hemShineRef = useRef<SVGPathElement>(null);
  const hemStitchRef = useRef<SVGPathElement>(null);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<() => void>(() => {});
  const [active, setActive] = useState(true);

  useEffect(() => {
    const html = document.documentElement;
    const root = rootRef.current;
    if (html.dataset.intro !== "play" || !root) {
      const off = requestAnimationFrame(() => setActive(false));
      return () => cancelAnimationFrame(off);
    }
    window.scrollTo(0, 0);

    let cancelled = false;
    let raf = 0;
    let scene: IntroScene | null = null;
    let start = 0;
    let layout: IntroLayout = {
      width: window.innerWidth,
      height: window.innerHeight,
      mascot: mascotSize(window.innerWidth, window.innerHeight),
      gripOffset: 0,
    };
    // Development aid: ?introAt=1.2 freezes the opening at 1.2 s.
    const freezeParam = new URLSearchParams(location.search).get("introAt");
    const freeze = process.env.NODE_ENV !== "production" && freezeParam ? Number(freezeParam) : null;

    const measure = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const mascot = mascotSize(width, height);
      scene?.resize(width, height, mascot);
      svgRef.current?.setAttribute("viewBox", `0 0 ${width} ${height}`);
      layout = { width, height, mascot, gripOffset: mascot * FALLBACK_GRIP_RATIO };
    };

    const end = () => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      finish(root);
      window.setTimeout(() => {
        scene?.dispose();
        scene = null;
        setActive(false);
      }, 280);
    };
    skipRef.current = end;

    const frame = (now: number) => {
      if (cancelled) return;
      if (!start) start = now;
      const t = freeze ?? (now - start) / 1000;
      const s = introAt(t, layout, blinkAt(t));

      // Where the hem is held: the 3D hands, or the 2D mascot's hands in the fallback.
      let hold: { x: number; y: number; span: number };
      if (scene) {
        hold = scene.render(s);
      } else {
        hold = { x: layout.width / 2, y: s.feet - layout.gripOffset, span: layout.mascot * 0.27 };
        const img = flatRef.current;
        if (img) {
          const sway = 0.05 * Math.sin(s.pose.walk) * s.pose.walkAmount;
          img.style.transform = `translate3d(-50%, ${s.feet - layout.mascot}px, 0) rotate(${sway}rad) scaleY(${s.pose.stretch})`;
        }
      }

      const input: HemInput = {
        width: layout.width,
        cx: hold.x,
        edge: hold.y,
        hold: hold.span,
        lag: s.lag,
        phase: s.pose.walk,
        ripple: s.pose.walkAmount,
      };
      const hem = hemAt(input);

      // Below the hem: the curtain still covers. Above it: the real page, with blanket folds.
      if (curtainRef.current) curtainRef.current.style.clipPath = belowHemPolygon(hem, layout.height);
      const line = hemPath(hem);
      const folds = foldPaths(input, hem);
      const tension = Math.min(1, s.lag / 90);
      clothClipRef.current?.setAttribute("d", aboveHemPath(hem));
      shadeRef.current?.setAttribute("d", folds.shade);
      lightRef.current?.setAttribute("d", folds.light);
      shadeRef.current?.setAttribute("opacity", String(0.22 * tension));
      lightRef.current?.setAttribute("opacity", String(0.14 * tension));
      bandRef.current?.setAttribute("d", line);
      hemShadowRef.current?.setAttribute("d", hemPath(hem, 9));
      hemRef.current?.setAttribute("d", line);
      hemShineRef.current?.setAttribute("d", hemPath(hem, -4));
      hemStitchRef.current?.setAttribute("d", hemPath(hem, 4));

      if (brandRef.current) brandRef.current.style.opacity = String(s.brandOpacity);
      if (skipButtonRef.current)
        skipButtonRef.current.style.opacity = String(
          Math.max(0, Math.min(1, (layout.height * 0.82 - hold.y) / 120)),
        );

      if (t >= INTRO_DURATION && freeze === null) {
        end();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const play = () => {
      if (cancelled) return;
      measure();
      root.dataset.mode = scene ? "3d" : "2d";
      if (flatRef.current) flatRef.current.style.height = `${layout.mascot}px`;
      raf = requestAnimationFrame(frame);
    };

    const fallback = window.setTimeout(() => {
      if (!scene && !start) play();
    }, LOAD_BUDGET_MS);

    import("./intro-scene")
      .then(({ createIntroScene }) => {
        if (cancelled || start) return;
        const canvas = canvasRef.current;
        scene = canvas ? createIntroScene(canvas) : null;
        window.clearTimeout(fallback);
        play();
      })
      .catch(() => {
        window.clearTimeout(fallback);
        play();
      });

    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      window.removeEventListener("resize", onResize);
      scene?.dispose();
      scene = null;
    };
  }, []);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className="dimsum-intro fixed inset-0 z-[95] touch-none overflow-hidden select-none"
      aria-hidden="true"
      onPointerDown={() => skipRef.current()}
    >
      <div
        ref={curtainRef}
        data-theme="dark"
        className="dimsum-intro__curtain absolute inset-0 bg-ink-950 will-change-[clip-path]"
      >
        {/* Soft red glow on the curtain. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70dvh] bg-[radial-gradient(60%_55%_at_50%_75%,rgba(216,42,30,0.3),transparent_70%)]" />
        <div
          ref={brandRef}
          className="absolute inset-x-0 bottom-[calc(var(--safe-bottom)+14dvh)] flex flex-col items-center px-6 text-center text-white opacity-0"
        >
          <Logo withTagline className="h-14 text-white sm:h-16" />
          <p className="mt-5 text-body-sm font-medium text-white/60">Ravioli, bao e noodles fatti a mano</p>
        </div>
      </div>

      {/* The blanket: folds over the revealed page and the rolled red hem. */}
      <svg ref={svgRef} className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        <defs>
          <clipPath id="dimsum-intro-cloth">
            <path ref={clothClipRef} d="" />
          </clipPath>
          <filter id="dimsum-intro-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="dimsum-intro-blur" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <linearGradient id="dimsum-intro-hem" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ee5446" />
            <stop offset="0.55" stopColor="#d82a1e" />
            <stop offset="1" stopColor="#9e1b13" />
          </linearGradient>
        </defs>
        <g clipPath="url(#dimsum-intro-cloth)">
          <path ref={shadeRef} d="" fill="#3b2a20" filter="url(#dimsum-intro-soft)" opacity="0" />
          <path ref={lightRef} d="" fill="#ffffff" filter="url(#dimsum-intro-soft)" opacity="0" />
          {/* The page curls slightly where it is held: a soft band of shade along the hem. */}
          <path
            ref={bandRef}
            d=""
            fill="none"
            stroke="#2b1d14"
            strokeOpacity="0.16"
            strokeWidth="44"
            filter="url(#dimsum-intro-blur)"
          />
        </g>
        <path
          ref={hemShadowRef}
          d=""
          fill="none"
          stroke="#000"
          strokeOpacity="0.45"
          strokeWidth="16"
          filter="url(#dimsum-intro-blur)"
        />
        <path
          ref={hemRef}
          d=""
          fill="none"
          stroke="url(#dimsum-intro-hem)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          ref={hemShineRef}
          d=""
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.35"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          ref={hemStitchRef}
          d=""
          fill="none"
          stroke="#fdeeec"
          strokeOpacity="0.7"
          strokeWidth="1.4"
          strokeDasharray="6 5"
        />
      </svg>

      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      {/* 2D version (no WebGL, or the 3D engine took too long). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={flatRef}
        src="/brand/mascot.webp"
        alt=""
        className="dimsum-intro__flat absolute top-0 left-1/2 w-auto origin-bottom will-change-transform"
        style={{ transform: "translate(-50%, -110%)" }}
      />

      <button
        ref={skipButtonRef}
        type="button"
        tabIndex={-1}
        className="absolute right-4 bottom-[calc(var(--safe-bottom)+16px)] rounded-full bg-white/10 px-4 py-2 text-caption font-semibold text-white/80 ring-1 ring-white/15 backdrop-blur"
      >
        Salta
      </button>
    </div>
  );
}
