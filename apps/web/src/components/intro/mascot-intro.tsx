"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import type { IntroScene } from "./intro-scene";
import {
  blinkAt,
  FALLBACK_GRIP_RATIO,
  INTRO_DURATION,
  introAt,
  mascotSize,
  type IntroLayout,
} from "./timeline";

import { INTRO_SEEN_KEY as SEEN_KEY } from "./gate";
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
  root.style.transition = "opacity 220ms ease-out";
  root.style.opacity = "0";
  window.setTimeout(() => delete html.dataset.intro, 230);
}

/**
 * Opening of the web app: the DIMSUM mascot (3D) drops onto a dark curtain, waves, grabs the red
 * hem of the page coming down from the top and pulls it all the way down, revealing the home.
 * Tap anywhere to skip. Without WebGL the same choreography plays with the 2D mascot.
 */
export function MascotIntro() {
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flatRef = useRef<HTMLImageElement>(null);
  const flatBarRef = useRef<HTMLDivElement>(null);
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
      safeTop: 0,
    };
    // Development aid: ?introAt=1.2 freezes the opening at 1.2 s.
    const freezeParam = new URLSearchParams(location.search).get("introAt");
    const freeze = process.env.NODE_ENV !== "production" && freezeParam ? Number(freezeParam) : null;

    const measure = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const mascot = mascotSize(width, height);
      scene?.resize(width, height, mascot);
      layout = {
        width,
        height,
        mascot,
        gripOffset: scene ? scene.gripOffset : mascot * FALLBACK_GRIP_RATIO,
        safeTop: 0,
      };
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
      }, 260);
    };
    skipRef.current = end;

    const frame = (now: number) => {
      if (cancelled) return;
      if (!start) start = now;
      const t = freeze ?? (now - start) / 1000;
      const s = introAt(t, layout, blinkAt(t));
      if (curtainRef.current) curtainRef.current.style.clipPath = `inset(${Math.max(0, s.edge)}px 0 0 0)`;
      if (brandRef.current) brandRef.current.style.opacity = String(s.brandOpacity);
      if (scene) {
        scene.render(s);
      } else {
        const img = flatRef.current;
        const flatBar = flatBarRef.current;
        if (img) {
          img.style.height = `${layout.mascot}px`;
          img.style.transform = `translate(-50%, ${s.feet - layout.mascot}px) rotate(${s.pose.swing}rad) scaleY(${s.pose.stretch})`;
        }
        if (flatBar) flatBar.style.transform = `translateY(${s.edge}px)`;
      }
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

    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      window.removeEventListener("resize", measure);
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
      <div ref={curtainRef} data-theme="dark" className="dimsum-intro__curtain absolute inset-0 bg-ink-950">
        <div
          ref={brandRef}
          className="absolute inset-x-0 top-[calc(var(--safe-top)+11dvh)] flex flex-col items-center px-6 text-center text-white"
        >
          <Logo withTagline className="h-14 text-white sm:h-16" />
          <p className="mt-5 text-body-sm font-medium text-white/60">Ravioli, bao e noodles fatti a mano</p>
        </div>
        {/* Soft red glow behind the mascot. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60dvh] bg-[radial-gradient(60%_55%_at_50%_70%,rgba(216,42,30,0.28),transparent_70%)]" />
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      {/* 2D version (no WebGL, or the 3D engine took too long). */}
      <div
        ref={flatBarRef}
        className="dimsum-intro__flat-bar absolute inset-x-0 top-0 -mt-2 h-4 rounded-full bg-brand shadow-cta"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={flatRef}
        src="/brand/mascot.webp"
        alt=""
        className="dimsum-intro__flat absolute top-0 left-1/2 w-auto origin-bottom"
        style={{ transform: "translate(-50%, -110%)" }}
      />

      <button
        type="button"
        tabIndex={-1}
        className="absolute right-4 bottom-[calc(var(--safe-bottom)+16px)] rounded-full bg-white/10 px-4 py-2 text-caption font-semibold text-white/80 ring-1 ring-white/15 backdrop-blur"
      >
        Salta
      </button>
    </div>
  );
}
