import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MascotViewer } from "@/components/mascot/viewer";
export const metadata: Metadata = {
  title: "La mascotte DIMSUM in 3D",
  description: "Piccola, sorridente e tutta da scoprire. Esplora la mascotte DIMSUM in 3D.",
  alternates: { canonical: "/mascotte" },
  robots: { index: false, follow: true },
};
export default function MascotPage() {
  return (
    <main id="contenuto" className="min-h-screen bg-[#faf7ef] text-[#24221f]">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 md:px-10">
        <Link href="/" aria-label="DIMSUM, torna alla landing">
          <Logo className="h-10 text-fg" />
        </Link>
        <Link
          href="/menu"
          className="shrink-0 rounded-full bg-[#c6262e] px-5 py-3 text-sm font-bold text-white"
        >
          Vai al menu
        </Link>
      </header>
      <div className="mx-auto grid max-w-7xl items-center gap-9 px-5 pt-4 pb-14 lg:grid-cols-[.7fr_1fr] lg:gap-16 lg:px-10 lg:pt-8">
        <div>
          <Link href="/" className="text-sm font-semibold underline underline-offset-4">
            Scopri DIMSUM
          </Link>
          <p className="mt-8 text-sm font-bold tracking-[.13em] text-[#b4212b] uppercase">Piacere, DIMSUM</p>
          <h1 className="mt-4 text-[clamp(2.7rem,5.4vw,4.7rem)] leading-[1.02] font-black tracking-[-.055em]">
            Un raviolo.
            <br />
            Una personalità.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#6a6259]">
            Stesso sorriso, una dimensione in più. Gira intorno alla nostra mascotte e scopri ogni piccolo
            dettaglio.
          </p>
          <p className="mt-7 max-w-sm border-l-2 border-[#c6262e] pl-4 text-base leading-relaxed">
            Occhi curiosi, fiocco rosso e grembiule pronto: manca solo il tuo prossimo ordine.
          </p>
          <p className="mt-7 max-w-sm text-sm leading-relaxed text-[#766e64]">
            Una ricostruzione 3D stilizzata del personaggio originale. Il retro è stato interpretato a partire
            dall’illustrazione frontale.
          </p>
        </div>
        <MascotViewer />
      </div>
    </main>
  );
}
