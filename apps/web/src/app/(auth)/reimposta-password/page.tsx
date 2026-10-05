import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Nuova password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Scegli una nuova password" />
      <Suspense fallback={<div className="h-48 skeleton rounded-2xl" aria-hidden />}>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
