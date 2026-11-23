import { X } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MascotIntro } from "@/components/intro/mascot-intro";
import { RestaurantProvider } from "@/components/shop/restaurant-context";
import { getRestaurantConfig, toRestaurantInfo } from "@/server/services/restaurant";

/** The three hero dishes (top-down cutouts): they spin slowly on the brand panel. */
const DISHES = [
  { src: "/images/hero/ravioli-al-vapore.webp", label: "Ravioli al vapore" },
  { src: "/images/hero/noodles-in-brodo.webp", label: "Noodles in brodo" },
  { src: "/images/hero/bao-pollo-croccante.webp", label: "Bao" },
] as const;

const CSS = `
.auth-plates{position:relative}
.auth-plate{position:absolute;display:block;filter:drop-shadow(0 30px 40px rgba(0,0,0,.45))}
.auth-plate img{width:100%;height:100%;display:block;animation:auth-spin var(--spin,60s) linear infinite;animation-direction:var(--dir,normal)}
.auth-plate-wrap{display:block;width:100%;height:100%;animation:auth-float 7s ease-in-out infinite;animation-delay:var(--delay,0s)}
@keyframes auth-spin{to{transform:rotate(360deg)}}
@keyframes auth-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
.auth-plate-in{animation:auth-in .9s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--in,0s)}
@keyframes auth-in{from{opacity:0;transform:scale(.7) rotate(-25deg)}to{opacity:1;transform:none}}
.auth-step{animation:auth-step .38s cubic-bezier(.2,.8,.2,1) both}
@keyframes auth-step{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.auth-plate img,.auth-plate-wrap,.auth-plate-in,.auth-step{animation:none!important}}
`;

function Plate({
  dish,
  className,
  spin,
  reverse,
  delay,
  enter,
}: {
  dish: (typeof DISHES)[number];
  className: string;
  spin: string;
  reverse?: boolean;
  delay: string;
  enter: string;
}) {
  return (
    <span
      className={`auth-plate auth-plate-in ${className}`}
      style={{ "--spin": spin, "--dir": reverse ? "reverse" : "normal", "--delay": delay, "--in": enter } as React.CSSProperties}
    >
      <span className="auth-plate-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dish.src} alt="" width={760} height={760} draggable={false} />
      </span>
    </span>
  );
}

/**
 * Sign-in and sign-up: a dark brand panel with the three hero dishes slowly spinning (desktop), a
 * band with the same dishes above the form on phones.
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const restaurant = toRestaurantInfo(await getRestaurantConfig());
  const [ravioli, noodles, bao] = DISHES;

  return (
    <RestaurantProvider value={restaurant}>
      <style>{CSS}</style>
      {/* The installed app opens on the sign-in: the opening (blanket) plays here too. */}
      <MascotIntro />
      <div className="min-h-dvh lg:grid lg:grid-cols-2">
        <aside
          data-theme="dark"
          className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-12 text-white lg:flex xl:p-16"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: "radial-gradient(60% 50% at 60% 55%, rgba(198,38,46,.35), transparent 70%)" }}
            aria-hidden
          />
          <Link href="/" aria-label="DIMSUM, home" className="relative z-10 w-fit">
            <Logo withTagline className="h-14 text-white" />
          </Link>
          <div className="auth-plates relative mx-auto my-8 aspect-square w-full max-w-[520px]" aria-hidden>
            <Plate dish={ravioli} className="top-[6%] left-[4%] size-[56%]" spin="70s" delay="0s" enter=".05s" />
            <Plate dish={noodles} className="top-[34%] right-[0%] size-[50%]" spin="85s" reverse delay="-2.5s" enter=".2s" />
            <Plate dish={bao} className="bottom-[0%] left-[18%] size-[42%]" spin="60s" delay="-5s" enter=".35s" />
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
          {/* Phones: the dishes as a band above the form. */}
          <div className="auth-plates relative mx-auto h-36 w-full max-w-[420px] overflow-visible lg:hidden" aria-hidden>
            <Plate dish={noodles} className="top-2 left-[2%] size-28" spin="85s" reverse delay="-2.5s" enter=".15s" />
            <Plate dish={ravioli} className="top-0 left-[calc(50%-4.5rem)] size-36" spin="70s" delay="0s" enter="0s" />
            <Plate dish={bao} className="top-3 right-[2%] size-26" spin="60s" delay="-5s" enter=".3s" />
          </div>
          <main
            id="contenuto"
            className="flex flex-1 justify-center px-5 pb-[calc(var(--safe-bottom)+32px)] lg:items-center"
          >
            <div className="w-full max-w-[420px] pt-2 lg:pt-0">{children}</div>
          </main>
        </div>
      </div>
    </RestaurantProvider>
  );
}
