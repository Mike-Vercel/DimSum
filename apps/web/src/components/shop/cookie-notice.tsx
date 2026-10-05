"use client";

import { Cookie } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const KEY = "dimsum.cookie-notice";
const noop = () => () => {};

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * One-time information notice. Only technical cookies are used, so there is nothing to consent
 * to: no pre-ticked boxes, no "accept all", just what we do. It sits in the page flow under the
 * header, so it can never cover a button.
 */
export function CookieNotice() {
  const alreadySeen = useSyncExternalStore(noop, seen, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (alreadySeen || dismissed) return null;
  return (
    <div role="region" aria-label="Informativa cookie" className="bg-ink-950 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 lg:px-8">
        <Cookie className="size-4 shrink-0 text-red-400" aria-hidden />
        <p className="min-w-0 flex-1 text-caption leading-snug text-white/80">
          Solo cookie tecnici, per carrello, accesso e pagamenti. Niente profilazione né pubblicità.{" "}
          <Link href="/cookie" className="font-semibold text-white underline underline-offset-2">
            Dettagli
          </Link>
        </p>
        <Button
          size="sm"
          variant="white"
          className="h-8 px-3"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {
              /* private mode: the notice simply shows again next time */
            }
            setDismissed(true);
          }}
        >
          Ho capito
        </Button>
      </div>
    </div>
  );
}
