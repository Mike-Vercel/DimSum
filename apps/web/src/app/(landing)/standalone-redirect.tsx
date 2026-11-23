"use client";

import { useEffect } from "react";

/**
 * The installed app (PWA) never shows the landing, also when it is reached from inside the app
 * (the sign-in "X", the logo, signing out): straight to /app, i.e. sign-in or the menu. Opening the
 * app on "/" is already handled before the first paint by the gate script in the root layout.
 */
export function StandaloneRedirect() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) window.location.replace("/app");
  }, []);
  return null;
}
