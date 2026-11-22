"use client";

import { useRef, type ReactNode } from "react";

export interface FaqEntry {
  question: string;
  answer: ReactNode;
}

const OPEN_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const CLOSE_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * Questions that open with motion: the answer slides down while it fades in, the "+" turns into a
 * "×", and closing plays it backwards. Built on <details>, so without JavaScript (or with reduced
 * motion) it still opens and closes, just without the animation.
 */
export function FaqList({ items, className }: { items: FaqEntry[]; className?: string }) {
  return (
    <div className={className} data-stagger>
      {items.map((item) => (
        <FaqItem key={item.question} question={item.question}>
          {item.answer}
        </FaqItem>
      ))}
    </div>
  );
}

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const running = useRef<Animation | null>(null);

  const toggle = (event: React.MouseEvent) => {
    const d = details.current;
    const b = body.current;
    if (!d || !b || !b.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    running.current?.cancel();
    const opening = d.dataset.state !== "open";
    d.dataset.state = opening ? "open" : "closed";
    if (opening) {
      d.open = true;
      const height = b.scrollHeight;
      running.current = b.animate(
        [
          { height: "0px", opacity: 0, transform: "translateY(-8px)" },
          { height: `${height}px`, opacity: 1, transform: "none" },
        ],
        { duration: 420, easing: OPEN_EASE },
      );
      running.current.onfinish = () => (running.current = null);
    } else {
      const height = b.offsetHeight;
      running.current = b.animate(
        [
          { height: `${height}px`, opacity: 1 },
          { height: "0px", opacity: 0 },
        ],
        { duration: 300, easing: CLOSE_EASE },
      );
      running.current.onfinish = () => {
        d.open = false;
        running.current = null;
      };
    }
  };

  return (
    <details ref={details}>
      <summary onClick={toggle}>
        <span>{question}</span>
        <i aria-hidden />
      </summary>
      <div ref={body} data-faq-body>
        {children}
      </div>
    </details>
  );
}
