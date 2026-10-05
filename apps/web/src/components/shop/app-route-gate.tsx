"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Screens that behave like app views on phones: the website footer stays on desktop only. */
const APP_ROUTES = ["/account", "/cart", "/checkout"];

export function DesktopOnlyOnAppRoutes({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const app = APP_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  return <div className={app ? "max-lg:hidden" : undefined}>{children}</div>;
}
