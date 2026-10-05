import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";
import { features } from "@/server/env";

export const metadata: Metadata = {
  title: "Accedi",
  robots: { index: false, follow: true },
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  const f = features();
  return (
    <>
      <AuthHeading title="Bentornato" description="Accedi per ritrovare ordini, indirizzi e preferiti." />
      <Suspense fallback={<div className="h-80 skeleton rounded-2xl" aria-hidden />}>
        <LoginForm google={f.googleButton} apple={f.appleAuth} />
      </Suspense>
    </>
  );
}
