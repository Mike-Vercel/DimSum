import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Rider", template: "%s · Rider DIMSUM" },
  robots: { index: false, follow: false },
  manifest: "/rider.webmanifest",
  appleWebApp: { capable: true, title: "DIMSUM Rider", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0e0d0c" };

/** Rider app: dark, one-handed, readable in sunlight. */
export default function RiderLayout({ children }: LayoutProps<"/rider">) {
  return (
    <div data-theme="dark" className="min-h-dvh bg-canvas text-fg">
      <main id="contenuto">{children}</main>
    </div>
  );
}
