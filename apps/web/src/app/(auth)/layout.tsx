import { X } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { FoodImage } from "@/components/shop/food-image";
import { cn } from "@/lib/cn";
import { getCatalog } from "@/server/services/catalog";

/** Focused shell for sign-in pages: brand panel with real menu photos on desktop, full screen on phones. */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const catalog = await getCatalog();
  // Bestsellers first, then the rest of the menu: always three real dishes shot on the dark set.
  const ordered = [...new Set([...catalog.bestsellerIds, ...Object.keys(catalog.products)])];
  const photos = ordered
    .map((id) => catalog.products[id])
    .filter((p) => p?.image?.backdrop === "DARK")
    .slice(0, 3);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside
        data-theme="dark"
        className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-12 text-white lg:flex xl:p-16"
      >
        <Link href="/" aria-label="DIMSUM, home" className="relative z-10 w-fit">
          <Logo withTagline className="h-14 text-white" />
        </Link>
        <div
          className="relative mx-auto my-10 grid w-full max-w-lg grid-cols-2 grid-rows-2 gap-4"
          aria-hidden
        >
          {photos.map((p, i) =>
            p ? (
              <FoodImage
                key={p.id}
                image={p.image}
                sizes="(min-width: 1024px) 20vw, 1px"
                rounded="rounded-3xl"
                className={cn(
                  "shadow-2xl",
                  i === 0 ? "row-span-2 min-h-80" : "aspect-square",
                  i === 1 && "translate-y-4 rotate-2",
                  i === 2 && "-rotate-2",
                )}
              />
            ) : null,
          )}
        </div>
        <p className="text-title-lg relative z-10 max-w-sm font-bold text-balance">
          Ravioli, bao e noodles a Palermo. <span className="text-red-400">Ordina in pochi tocchi.</span>
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col bg-canvas">
        <header className="flex items-center justify-between px-4 pt-safe">
          <div className="flex h-16 items-center">
            <Link
              href="/"
              aria-label="Chiudi e torna alla home"
              className="grid size-10 tap place-items-center rounded-full bg-surface ring-1 ring-line"
            >
              <X className="size-5" />
            </Link>
          </div>
          <Logo className="h-5 text-fg lg:hidden" />
          <span className="size-10" aria-hidden />
        </header>
        <main
          id="contenuto"
          className="flex flex-1 justify-center px-5 pb-[calc(var(--safe-bottom)+32px)] lg:items-center"
        >
          <div className="w-full max-w-[420px] pt-4 lg:pt-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
