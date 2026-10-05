import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Providers } from "@/components/providers";
import { resolveAppUrl } from "@/lib/app-url";
import "@/styles/globals.css";

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const appUrl = resolveAppUrl();

const splash = [
  [1320, 2868, 440, 956, 3],
  [1290, 2796, 430, 932, 3],
  [1206, 2622, 402, 874, 3],
  [1179, 2556, 393, 852, 3],
  [1170, 2532, 390, 844, 3],
  [1125, 2436, 375, 812, 3],
  [828, 1792, 414, 896, 2],
  [750, 1334, 375, 667, 2],
] as const;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "DIMSUM · Asian street food a Palermo — Ordina online",
    template: "%s · DIMSUM",
  },
  description:
    "Ravioli al vapore e alla piastra, bao, noodles e riso saltato. Ordina online da DIMSUM, Via Emerico Amari 47, Palermo: consegna a domicilio o ritiro al locale.",
  applicationName: "DIMSUM",
  keywords: [
    "dim sum Palermo",
    "ravioli cinesi Palermo",
    "bao Palermo",
    "noodles Palermo",
    "consegna cibo asiatico Palermo",
    "ristorante cinese Palermo",
  ],
  formatDetection: { telephone: false, address: false, email: false },
  appleWebApp: {
    capable: true,
    title: "DIMSUM",
    statusBarStyle: "black-translucent",
    startupImage: splash.map(([w, h, dw, dh, r]) => ({
      url: `/splash/splash-${w}x${h}.png`,
      media: `(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "DIMSUM",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // App-like: no pinch or double-tap zoom (iOS Safari ignores this, see Providers and globals.css).
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0d0c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={archivo.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <a
          href="#contenuto"
          className="sr-only z-[100] rounded-full bg-ink-900 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Vai al contenuto
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
