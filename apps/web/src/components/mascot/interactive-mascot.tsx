"use client";

import { useEffect, useRef, useState } from "react";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import type { InteractiveScene } from "./interactive-scene";

/**
 * The DIMSUM mascot in 3D, alive on the page: it follows the pointer (or the finger) with its
 * eyes, turns when dragged sideways and reacts to taps (jump and wave, spin, dance). Vertical
 * swipes still scroll the page on phones. The 3D engine loads only when the stage approaches the
 * viewport and the render loop stops off-screen; without WebGL the 2D mascot is shown.
 */
export function InteractiveMascot({
  className,
  label = "Mascotte DIMSUM in 3D",
}: {
  className?: string;
  label?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "ready" | "flat">("idle");

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let scene: InteractiveScene | null = null;
    let disposed = false;
    let visible = false;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    const sync = () => scene?.setRunning(visible && !document.hidden);

    const mount = async () => {
      try {
        const { createInteractiveScene } = await import("./interactive-scene");
        if (disposed) return;
        scene = createInteractiveScene({ reducedMotion });
      } catch {
        scene = null;
      }
      if (disposed) {
        scene?.dispose();
        return;
      }
      if (!scene) {
        setState("flat");
        return;
      }
      const s = scene;
      const canvas = s.canvas;
      canvas.className = "absolute inset-0 size-full cursor-grab touch-pan-y active:cursor-grabbing";
      canvas.setAttribute("aria-hidden", "true");
      stage.appendChild(canvas);

      const resize = () => s.resize(stage.clientWidth || 1, stage.clientHeight || 1);
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(stage);
      cleanups.push(() => ro.disconnect());

      // Eyes follow the pointer anywhere on the page (desktop) or the finger on the stage.
      const onMove = (e: PointerEvent) => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / Math.max(r.width, 320);
        const y = (e.clientY - (r.top + r.height * 0.35)) / Math.max(r.height, 320);
        s.look(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => window.removeEventListener("pointermove", onMove));

      // Drag sideways to turn, tap to poke. Vertical movement is left to the page scroll.
      let downX = 0,
        downY = 0,
        lastX = 0,
        moved = false,
        pointer: number | null = null;
      const onDown = (e: PointerEvent) => {
        pointer = e.pointerId;
        downX = lastX = e.clientX;
        downY = e.clientY;
        moved = false;
        onMove(e);
      };
      const onDrag = (e: PointerEvent) => {
        if (pointer !== e.pointerId) return;
        if (
          !moved &&
          Math.abs(e.clientX - downX) > 6 &&
          Math.abs(e.clientX - downX) > Math.abs(e.clientY - downY)
        ) {
          moved = true;
          canvas.setPointerCapture(e.pointerId);
        }
        if (moved) {
          s.drag(e.clientX - lastX);
          lastX = e.clientX;
        } else if (Math.abs(e.clientY - downY) > 10) {
          pointer = null; // a vertical swipe: the page scrolls
        }
      };
      const onUp = (e: PointerEvent) => {
        if (pointer !== e.pointerId) return;
        pointer = null;
        if (moved) s.release();
        else {
          s.poke();
          haptics.tap();
        }
      };
      const onCancel = () => {
        if (pointer !== null) s.release();
        pointer = null;
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onDrag);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onCancel);
      cleanups.push(() => {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onDrag);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onCancel);
      });

      document.addEventListener("visibilitychange", sync);
      cleanups.push(() => document.removeEventListener("visibilitychange", sync));
      setState("ready");
      sync();
    };

    // Load near the viewport; run only while visible.
    let started = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible && !started) {
          started = true;
          void mount();
        }
        sync();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(stage);

    return () => {
      disposed = true;
      io.disconnect();
      cleanups.forEach((c) => c());
      scene?.dispose();
      scene?.canvas.remove();
      scene = null;
    };
  }, []);

  return (
    <div
      ref={stageRef}
      role="img"
      aria-label={`${label}. Toccala per farla saltare, trascinala di lato per girarla.`}
      className={cn("relative select-none", className)}
    >
      {state !== "ready" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brand/mascot.webp"
          alt=""
          className={cn(
            "absolute inset-0 m-auto h-[82%] w-auto object-contain transition-opacity",
            state === "idle" && "opacity-90",
          )}
        />
      ) : null}
    </div>
  );
}
