import type { ImageDTO } from "@dimsum/types";
import { ArrowRight, Bike, Store } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { FoodImage } from "./food-image";

/** Mobile hero card (reference screen 2): dark card, dish photo, "Scopri il menu →". */
export function MobileHero({ image, href }: { image: ImageDTO | null; href: string }) {
  return (
    <Link
      href={href}
      className="group relative block tap overflow-hidden rounded-3xl bg-ink-950 text-white shadow-md lg:hidden"
      data-theme="dark"
    >
      <div className="absolute inset-y-0 right-0 w-[62%]">
        <FoodImage
          image={image}
          sizes="62vw"
          priority
          rounded="rounded-none"
          className="size-full"
          imgClassName="group-hover:scale-105"
          fit="cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/40 to-transparent" />
      </div>
      <div className="relative flex min-h-48 max-w-[62%] flex-col justify-between p-5">
        <h2 className="text-title leading-tight font-extrabold">Noodles che fanno viaggiare</h2>
        <span className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-red-400">
          Scopri il menu <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/** Desktop editorial hero: claim on the left, collage of real dishes on the right. */
export function DesktopHero({ images }: { images: (ImageDTO | null)[] }) {
  const [a, b, c] = images;
  return (
    <section
      className="relative hidden overflow-hidden rounded-[40px] bg-ink-950 text-white lg:block"
      data-theme="dark"
      aria-label="DIMSUM"
    >
      <div className="grid min-h-[520px] grid-cols-[1.05fr_1fr] items-center gap-10 px-14 py-14 xl:px-20">
        <div className="max-w-xl">
          <Logo withTagline className="h-16 text-white" />
          <h1 className="mt-10 text-hero font-extrabold tracking-tight">
            Il gusto dell&apos;Asia,
            <br />a casa tua.
          </h1>
          <p className="mt-5 max-w-md text-title-sm text-fg-muted">
            Ravioli al vapore e alla piastra, bao e noodles fatti da noi. Ordina online: consegna a domicilio
            o ritiro al locale.
          </p>
          <div className="mt-9 flex gap-3">
            <Link
              href="/menu"
              className="inline-flex h-14 tap items-center gap-2 rounded-2xl bg-brand px-7 text-title-sm font-bold shadow-cta hover:bg-red-600"
            >
              Ordina ora <ArrowRight className="size-5" />
            </Link>
            <Link
              href="/info"
              className="inline-flex h-14 tap items-center gap-2 rounded-2xl bg-white/10 px-6 font-semibold ring-1 ring-white/15 hover:bg-white/15"
            >
              Il locale
            </Link>
          </div>
          <ul className="mt-10 flex gap-8 text-body-sm text-fg-muted">
            <li className="flex items-center gap-2">
              <Bike className="size-5 text-red-400" aria-hidden /> Consegna a domicilio
            </li>
            <li className="flex items-center gap-2">
              <Store className="size-5 text-red-400" aria-hidden /> Ritiro al locale
            </li>
          </ul>
        </div>
        <div className="relative h-[440px]">
          <FoodImage
            image={a ?? null}
            sizes="420px"
            priority
            rounded="rounded-[32px]"
            className="absolute top-0 right-0 h-[300px] w-[78%] shadow-lg"
            fit="cover"
          />
          <FoodImage
            image={b ?? null}
            sizes="260px"
            rounded="rounded-[28px]"
            className="absolute bottom-0 left-0 h-[220px] w-[52%] shadow-lg ring-4 ring-ink-950"
            fit="cover"
          />
          <FoodImage
            image={c ?? null}
            sizes="200px"
            rounded="rounded-[24px]"
            className="absolute right-6 bottom-6 h-[150px] w-[36%] shadow-lg ring-4 ring-ink-950"
            fit="cover"
          />
        </div>
      </div>
    </section>
  );
}
