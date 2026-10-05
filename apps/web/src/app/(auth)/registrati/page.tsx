import { Bike, Heart, MapPin, RotateCcw, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { RegisterForm } from "@/components/auth/register-form";
import { features } from "@/server/env";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = {
  title: "Crea il tuo account",
  description: "Riordina in un tocco, salva indirizzi e preferiti, segui i tuoi ordini.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/registrati" },
};

export default async function RegisterPage() {
  const f = features();
  const config = await getRestaurantConfig();
  const benefits = [
    { icon: RotateCcw, text: "Riordina i tuoi piatti in un tocco" },
    { icon: MapPin, text: "Indirizzi salvati, checkout più veloce" },
    { icon: Bike, text: "Tutti i tuoi ordini, in corso e passati" },
    { icon: Heart, text: "Preferiti su tutti i tuoi dispositivi" },
    ...(config.loyalty.enabled
      ? [{ icon: Sparkles, text: `${config.loyalty.programName}: punti su ogni ordine` }]
      : []),
  ];
  return (
    <>
      <AuthHeading title="Crea il tuo account" />
      <ul className="-mt-4 mb-8 grid gap-2.5">
        {benefits.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-body-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
              <Icon className="size-4" />
            </span>
            {text}
          </li>
        ))}
      </ul>
      <Suspense fallback={<div className="h-96 skeleton rounded-2xl" aria-hidden />}>
        <RegisterForm google={f.googleButton} apple={f.appleAuth} />
      </Suspense>
    </>
  );
}
