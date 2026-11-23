"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Screens that behave like app views on phones: the website footer stays on desktop only. In the
 * installed app (PWA) there is no website footer at all.
 */
const APP_ROUTES = ["/account", "/cart", "/checkout"];

export function DesktopOnlyOnAppRoutes({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const app = APP_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  return (
    <div className={app ? "pwa-hidden max-lg:hidden" : "pwa-hidden"}>
      {children}
    </div>
  );
}
