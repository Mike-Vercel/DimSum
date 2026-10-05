"use client";

import Link from "next/link";
import { useState } from "react";
import { AppleIcon, GoogleIcon } from "@/components/brand/provider-icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { signIn } from "@/lib/auth-client";
import type { ProviderButton } from "@/lib/auth-providers";

/** Development only: the Google button is shown before its keys exist, and says what is missing. */
export function explainGoogleSetup(): void {
  toast.info("Accesso con Google da configurare", {
    description:
      "Aggiungi GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nel file .env: i passaggi sono nel README.",
  });
}

/** "Continua con Google / Apple". After the provider, the customer lands back on `callbackURL`. */
export function SocialButtons({
  google,
  apple,
  callbackURL,
}: {
  google: ProviderButton;
  apple: boolean;
  callbackURL: string;
}) {
  const [pending, setPending] = useState<"google" | "apple" | null>(null);
  if (google === "off" && !apple) return null;

  const start = async (provider: "google" | "apple") => {
    setPending(provider);
    const { error } = await signIn.social({
      provider,
      callbackURL,
      newUserCallbackURL: callbackURL,
      errorCallbackURL: "/login?errore=social",
    });
    if (error) {
      setPending(null);
      toast.error("Accesso non riuscito", { description: "Riprova tra qualche istante." });
    }
  };

  return (
    <div className="grid gap-2.5">
      {google !== "off" ? (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          block
          loading={pending === "google"}
          disabled={pending !== null}
          onClick={() => (google === "setup" ? explainGoogleSetup() : void start("google"))}
        >
          <GoogleIcon className="size-5" /> Continua con Google
        </Button>
      ) : null}
      {apple ? (
        <Button
          type="button"
          variant="dark"
          size="lg"
          block
          loading={pending === "apple"}
          disabled={pending !== null}
          onClick={() => void start("apple")}
        >
          <AppleIcon className="size-5" /> Continua con Apple
        </Button>
      ) : null}
      <p className="text-center text-caption text-fg-subtle">
        Continuando accetti i{" "}
        <Link href="/termini" className="underline underline-offset-2">
          Termini
        </Link>{" "}
        e confermi di aver letto l&apos;
        <Link href="/privacy" className="underline underline-offset-2">
          Informativa privacy
        </Link>
        .
      </p>
    </div>
  );
}
