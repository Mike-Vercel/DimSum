import { INTRO_SEEN_KEY } from "./gate";
import { introRunnerScript } from "./runner";

/**
 * Opening of the web app. The page comes down like a blanket: the DIMSUM mascot, seen from behind,
 * holds its red hem and walks down the screen pulling it, until it walks off the bottom and the
 * home is fully revealed. Tap anywhere to skip.
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
        <div
          data-k="curtain"
          data-theme="dark"
          className="absolute inset-0 bg-ink-950 will-change-[clip-path]"
          suppressHydrationWarning
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70dvh] bg-[radial-gradient(60%_55%_at_50%_75%,rgba(216,42,30,0.3),transparent_70%)]" />
          <div className="absolute inset-x-0 bottom-[calc(var(--safe-bottom)+14dvh)] flex flex-col items-center px-6 text-center text-white">
            <span className="flex h-16 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/mascot.webp" alt="" width={57} height={64} className="h-16 w-auto" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/dimsum-lockup-white.svg"
                alt="DIMSUM"
                width={180}
                height={30}
                className="h-8 w-auto"
              />
            </span>
            <p className="mt-5 text-body-sm font-medium text-white/60">Ravioli, bao e noodles fatti a mano</p>
          </div>
        </div>

        {/* The blanket: folds over the revealed page and the rolled red hem. */}
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden suppressHydrationWarning>
          <defs>
            <clipPath id="dimsum-intro-cloth">
              <path data-k="clip" d="" suppressHydrationWarning />
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
            <path
              data-k="shade"
              d=""
              fill="#3b2a20"
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
            <path
              data-k="band"
              d=""
              fill="none"
              stroke="#2b1d14"
              strokeOpacity="0.16"
              strokeWidth="44"
              filter="url(#dimsum-intro-blur)"
              suppressHydrationWarning
            />
          </g>
          <path
            data-k="hem-shadow"
            d=""
            fill="none"
            stroke="#000"
            strokeOpacity="0.45"
            strokeWidth="16"
            filter="url(#dimsum-intro-blur)"
            suppressHydrationWarning
          />
          <path
            data-k="hem"
            d=""
            fill="none"
            stroke="url(#dimsum-intro-hem)"
            strokeWidth="18"
            strokeLinecap="round"
            suppressHydrationWarning
          />
          <path
            data-k="shine"
            d=""
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.35"
            strokeWidth="3"
            strokeLinecap="round"
            suppressHydrationWarning
          />
          <path
            data-k="stitch"
            d=""
            fill="none"
            stroke="#fdeeec"
            strokeOpacity="0.7"
            strokeWidth="1.4"
            strokeDasharray="6 5"
            suppressHydrationWarning
          />
        </svg>

        {/* The mascot: one frame of the pre-rendered 3D walk cycle (sprite sheet). */}
        <div
          data-k="mascot"
          className="absolute top-0 left-0 bg-no-repeat opacity-0 will-change-transform"
          style={{ transform: "translate3d(0,-120%,0)" }}
          suppressHydrationWarning
        />

        <button
          data-k="skip"
          type="button"
          tabIndex={-1}
          className="absolute right-4 bottom-[calc(var(--safe-bottom)+16px)] rounded-full bg-white/10 px-4 py-2 text-caption font-semibold text-white/80 ring-1 ring-white/15 backdrop-blur"
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
