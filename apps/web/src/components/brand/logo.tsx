import { cn } from "@/lib/cn";
import { LOGO } from "./logo-data";

const x0 = LOGO.wordmark.x0 - 1;
const width = LOGO.wordmark.width - LOGO.wordmark.x0 + 2;

/**
 * DIMSUM logotype: expanded wordmark + red 点心 ("dim sum") seal, as in the brand reference.
 * Pure vector, inherits `color` for the wordmark.
 */
export function Logo({
  className,
  withTagline = false,
  title = "DIMSUM",
  sealClassName,
}: {
  className?: string;
  withTagline?: boolean;
  title?: string;
  sealClassName?: string;
}) {
  const height = (withTagline ? LOGO.tagline.height : LOGO.wordmark.height) + 2;
  return (
    <svg
      viewBox={`${x0} -1 ${width} ${height}`}
      role="img"
      aria-label={title}
      className={cn("block h-6 w-auto", className)}
    >
      <path d={LOGO.wordmark.d} fill="currentColor" />
      <path d={LOGO.seal.d} className={cn("fill-red-500 dark:fill-red-400", sealClassName)} />
      {withTagline ? <path d={LOGO.tagline.d} fill="currentColor" fillOpacity={0.62} /> : null}
    </svg>
  );
}

/** The red 点心 seal alone (app icon, compact headers, map markers). */
export function Seal({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`${LOGO.seal.x} 0 ${LOGO.seal.width} ${LOGO.seal.height}`}
      aria-hidden
      className={cn("block h-6 w-auto", className)}
    >
      <path d={LOGO.seal.d} fill="currentColor" />
    </svg>
  );
}
