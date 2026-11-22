"use client";

import { useEffect } from "react";

/**
 * The landing's motion, without any markup of its own:
 * - elements marked `data-reveal` ("up", "title", "left", "right", "zoom") come in when they scroll
 *   into view; `data-stagger` on a parent delays its children one after another;
 * - from the second section on, the header slides away while scrolling down and comes back as
 *   soon as the visitor scrolls up.
 * Without JavaScript (or with reduced motion) everything is simply shown: the hidden starting state
 * only applies once this has run (`data-motion` on the page).
 */
export function LandingMotion({ rootId, headerId, fromId }: { rootId: string; headerId: string; fromId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- Reveals ---
    let io: IntersectionObserver | null = null;
    if (!reduced && "IntersectionObserver" in window) {
      root.querySelectorAll<HTMLElement>("[data-stagger]").forEach((group) => {
        Array.from(group.children).forEach((child, i) => {
          (child as HTMLElement).style.setProperty("--reveal-i", String(i));
        });
      });
      const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal], [data-stagger] > *"));
      // Already on screen: shown as they are, never hidden and replayed.
      for (const el of items) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.dataset.in = "";
      }
      root.dataset.motion = "";
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            (e.target as HTMLElement).dataset.in = "";
            io?.unobserve(e.target);
          }
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
      );
      for (const el of items) if (!("in" in el.dataset)) io.observe(el);
    }

    // --- Header: hides going down past the second section, back on the way up ---
    const header = document.getElementById(headerId);
    const from = document.getElementById(fromId);
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!header || !from) return;
        const y = window.scrollY;
        const past = y + header.offsetHeight >= from.getBoundingClientRect().top + y;
        const delta = y - lastY;
        if (!past || delta < -4) header.dataset.hidden = "false";
        else if (delta > 4) header.dataset.hidden = "true";
        if (Math.abs(delta) > 4) lastY = y;
      });
    };
    // Using the header's own links (anchors) or focusing it always brings it back.
    const show = () => header && (header.dataset.hidden = "false");
    window.addEventListener("scroll", onScroll, { passive: true });
    header?.addEventListener("focusin", show);

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      header?.removeEventListener("focusin", show);
      cancelAnimationFrame(frame);
    };
  }, [rootId, headerId, fromId]);

  return null;
}
