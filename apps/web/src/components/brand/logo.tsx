import Image from "next/image";
import { cn } from "@/lib/cn";
import { LOGO } from "./logo-data";

const x0 = LOGO.wordmark.x0 - 1;
const width = LOGO.wordmark.width - LOGO.wordmark.x0 + 2;

/** The approved restaurant mascot with the existing DIMSUM wordmark. */
export function Logo({
  className,
  withTagline = false,
  title = "DIMSUM",
}: {
  className?: string;
  withTagline?: boolean;
  title?: string;
  sealClassName?: string;
}) {
  const height = (withTagline ? LOGO.tagline.height : LOGO.wordmark.height) + 2;
  return (
    <span
      role="img"
      aria-label={title}
      className={cn("inline-flex h-12 max-w-full items-center gap-2", className)}
    >
      <Image
        src="/brand/mascot.webp"
        alt=""
        width={459}
        height={512}
        className="h-full w-auto shrink-0 object-contain"
        sizes="64px"
      />
      <svg
        viewBox={`${x0} -1 ${width} ${height}`}
        aria-hidden
        className="h-[55%] w-auto min-w-0 max-[360px]:h-[40%]"
      >
        <path d={LOGO.wordmark.d} fill="currentColor" />
        {withTagline ? <path d={LOGO.tagline.d} fill="currentColor" fillOpacity={0.62} /> : null}
      </svg>
    </span>
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
