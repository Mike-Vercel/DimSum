import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Accesso rider" };

export default function RiderLoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pt-[calc(var(--safe-top)+24px)] pb-[calc(var(--safe-bottom)+24px)]">
      <Logo className="h-7 text-fg" />
      <p className="mt-2 text-caption font-semibold tracking-[0.2em] text-fg-muted uppercase">App rider</p>
      <h1 className="mt-8 mb-6 text-display font-extrabold">Accedi</h1>
      <Suspense fallback={<div className="h-72 skeleton rounded-2xl" aria-hidden />}>
        <LoginForm google="off" apple={false} staffArea />
      </Suspense>
      <p className="mt-6 text-center text-caption text-fg-subtle">
        Non hai le credenziali? Chiedile al ristorante.
      </p>
    </div>
  );
}
