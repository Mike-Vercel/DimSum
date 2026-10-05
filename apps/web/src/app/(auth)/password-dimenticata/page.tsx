import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Password dimenticata", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        title="Password dimenticata?"
        description="Inserisci l'e-mail dell'account: ti mandiamo un link per sceglierne una nuova."
      />
      <Suspense fallback={<div className="h-48 skeleton rounded-2xl" aria-hidden />}>
        <ForgotPasswordForm />
      </Suspense>
    </>
  );
}
