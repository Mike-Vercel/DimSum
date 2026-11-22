import { INTRO_SEEN_KEY } from "./gate";
import { introRunnerScript } from "./runner";

/**
 * Opening of the web app: a white blanket covers the page; the DIMSUM mascot walks in from the
 * right, looks at us and waves, walks up, grabs the blanket's top edge and pulls it all the way
 * down, revealing the home. Tap anywhere to skip.
 *
 * Server-rendered markup plus an inline script (see runner.ts): it plays while the page is still
 * loading, without waiting for React, three.js or any bundle — no loading screen. Visible only when
 * the gate script decided to play it (html[data-intro="play"], see globals.css).
 */
export function MascotIntro() {
  return (
    <>
      <div
        id="dimsum-intro"
        className="dimsum-intro fixed inset-0 z-[95] touch-none overflow-hidden select-none"
        aria-hidden="true"
        suppressHydrationWarning
      >
        {/* The white blanket (below its top edge; clipped by the script). */}
        <div
          data-k="curtain"
          className="dimsum-blanket absolute inset-0 will-change-[clip-path]"
          suppressHydrationWarning
        >
          {/* Printed on the blanket: moves down with it. */}
          <div
            data-k="print"
            className="absolute inset-0 flex flex-col items-center pt-[calc(var(--safe-top)+20dvh)] text-center will-change-transform"
            suppressHydrationWarning
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/dimsum-lockup.svg"
              alt="DIMSUM"
              width={220}
              height={37}
              className="h-10 w-auto opacity-90"
            />
          </div>
        </div>

        {/* Folds of the blanket and its rolled top edge. */}
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden suppressHydrationWarning>
          <defs>
            <clipPath id="dimsum-intro-cloth">
              <path data-k="clip" d="" suppressHydrationWarning />
            </clipPath>
            <filter id="dimsum-intro-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <filter id="dimsum-intro-blur" x="-10%" y="-50%" width="120%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <linearGradient id="dimsum-intro-hem" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.6" stopColor="#f3efe8" />
              <stop offset="1" stopColor="#ddd5c9" />
            </linearGradient>
          </defs>
          {/* The page under the lifted edge is in shadow. */}
          <path
            data-k="hem-shadow"
            d=""
            fill="none"
            stroke="#2b1d14"
            strokeOpacity="0.28"
            strokeWidth="22"
            filter="url(#dimsum-intro-blur)"
            suppressHydrationWarning
          />
          <g clipPath="url(#dimsum-intro-cloth)">
            <path
              data-k="shade"
              d=""
              fill="#6b5f52"
              filter="url(#dimsum-intro-soft)"
              opacity="0"
              suppressHydrationWarning
            />
            <path
              data-k="light"
              d=""
              fill="#ffffff"
              filter="url(#dimsum-intro-soft)"
              opacity="0"
              suppressHydrationWarning
            />
            {/* The fabric just under the rolled edge. */}
            <path
              data-k="lift"
              d=""
              fill="none"
              stroke="#8a7d6e"
              strokeOpacity="0.18"
              strokeWidth="20"
              filter="url(#dimsum-intro-blur)"
              suppressHydrationWarning
            />
          </g>
          <path
            data-k="hem"
            d=""
            fill="none"
            stroke="url(#dimsum-intro-hem)"
            strokeWidth="16"
            strokeLinecap="round"
            suppressHydrationWarning
          />
          <path
            data-k="shine"
            d=""
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.95"
            strokeWidth="3"
            strokeLinecap="round"
            suppressHydrationWarning
          />
          <path
            data-k="stitch"
            d=""
            fill="none"
            stroke="#d82a1e"
            strokeOpacity="0.55"
            strokeWidth="1.3"
            strokeDasharray="5 5"
            suppressHydrationWarning
          />
        </svg>

        {/* Contact shadow under the mascot's feet while it stands on the blanket. */}
        <div
          data-k="contact"
          className="absolute top-0 left-0 h-4 rounded-[50%] bg-[radial-gradient(closest-side,rgba(60,45,30,0.32),transparent)] opacity-0 will-change-transform"
          suppressHydrationWarning
        />

        {/* The mascot: one frame of the pre-rendered 3D sequences (sprite sheet). */}
        <div
          data-k="mascot"
          className="absolute top-0 left-0 bg-no-repeat opacity-0 drop-shadow-[0_6px_10px_rgba(60,40,20,0.18)] will-change-transform"
          style={{ transform: "translate3d(0,-120%,0)" }}
          suppressHydrationWarning
        />

        <button
          data-k="skip"
          type="button"
          tabIndex={-1}
          className="absolute right-4 bottom-[calc(var(--safe-bottom)+16px)] rounded-full bg-black/5 px-4 py-2 text-caption font-semibold text-[#6b635b] ring-1 ring-black/10"
          suppressHydrationWarning
        >
          Salta
        </button>
      </div>
      {/* Starts the animation immediately, while the rest of the page is still loading. */}
      <script dangerouslySetInnerHTML={{ __html: introRunnerScript(INTRO_SEEN_KEY) }} />
    </>
  );
}
