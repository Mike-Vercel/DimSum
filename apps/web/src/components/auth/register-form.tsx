"use client";

import { email as emailSchema, personName } from "@dimsum/validation";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Divider } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/api";
import { signUp } from "@/lib/auth-client";
import type { ProviderButton } from "@/lib/auth-providers";
import { authErrorMessage, safeNext } from "@/lib/auth-routing";
import { haptics } from "@/lib/haptics";
import { PasswordInput } from "./password-input";
import { SocialButtons } from "./social-buttons";

const MIN_PASSWORD = 10;

/**
 * Account creation. Only the terms are required; marketing is a separate, unticked choice.
 * `?ordine=` links the guest order just placed, `?email=` prefills the address used at checkout.
 */
export function RegisterForm({ google, apple }: { google: ProviderButton; apple: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const orderToClaim = params.get("ordine");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination = next ?? (orderToClaim ? `/order/${orderToClaim}` : "/account");

  const submit = async () => {
    const parsedName = personName.safeParse(name);
    const parsedEmail = emailSchema.safeParse(email);
    const nextErrors: Record<string, string> = {};
    if (!parsedName.success)
      nextErrors.name = parsedName.error.issues[0]?.message ?? "Inserisci il tuo nome.";
    if (!parsedEmail.success) nextErrors.email = "Inserisci un indirizzo e-mail valido.";
    if (password.length < MIN_PASSWORD) nextErrors.password = `Almeno ${MIN_PASSWORD} caratteri.`;
    if (!terms) nextErrors.terms = "Per creare l'account devi accettare i Termini.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      haptics.error();
      return;
    }
    setBusy(true);
    setFailure(null);
    const { error } = await signUp.email({
      name: parsedName.data!,
      email: parsedEmail.data!,
      password,
      callbackURL: "/account?verificata=1",
    });
    if (error) {
      haptics.error();
      setFailure(authErrorMessage(error));
      setBusy(false);
      return;
    }
    await api.me
      .consents({
        consents: [
          { type: "TERMS", granted: true },
          { type: "PRIVACY", granted: true },
          { type: "MARKETING_EMAIL", granted: marketing },
        ],
        source: "signup",
      })
      .catch(() => undefined);
    if (orderToClaim) await api.orders.claim(orderToClaim).catch(() => undefined);
    haptics.success();
    toast.success("Account creato", {
      description: "Ti abbiamo inviato un'e-mail per confermare l'indirizzo.",
    });
    router.replace(destination);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <SocialButtons google={google} apple={apple} callbackURL={destination} />
      {google !== "off" || apple ? <Divider label="oppure con la tua e-mail" /> : null}

      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Nome e cognome" error={errors.name}>
          {(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="E-mail" error={errors.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Password"
          error={errors.password}
          hint={`Almeno ${MIN_PASSWORD} caratteri: una frase facile da ricordare va benissimo.`}
        >
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        <div className="space-y-3 pt-1">
          <label className="flex cursor-pointer items-start gap-3 text-body-sm">
            <Checkbox
              checked={terms}
              onCheckedChange={(v) => setTerms(v === true)}
              aria-invalid={!!errors.terms}
              className="mt-0.5"
            />
            <span>
              Accetto i{" "}
              <Link href="/termini" target="_blank" className="font-semibold underline underline-offset-4">
                Termini e condizioni
              </Link>{" "}
              e ho letto l&apos;
              <Link href="/privacy" target="_blank" className="font-semibold underline underline-offset-4">
                Informativa privacy
              </Link>
              .
            </span>
          </label>
          {errors.terms ? (
            <p className="text-caption font-medium text-danger" role="alert">
              {errors.terms}
            </p>
          ) : null}
          <label className="flex cursor-pointer items-start gap-3 text-body-sm text-fg-muted">
            <Checkbox
              checked={marketing}
              onCheckedChange={(v) => setMarketing(v === true)}
              className="mt-0.5"
            />
            <span>
              Voglio ricevere via e-mail offerte e novità di DIMSUM (facoltativo, puoi cambiare idea quando
              vuoi).
            </span>
          </label>
        </div>

        {failure ? <InlineAlert tone="danger" title={failure} /> : null}
        <Button type="submit" size="xl" block className="h-14" loading={busy}>
          Crea account
        </Button>
      </form>

      <p className="text-center text-body-sm text-fg-muted">
        Hai già un account?{" "}
        <Link
          href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-brand-ink underline-offset-4 hover:underline"
        >
          Accedi
        </Link>
      </p>
    </div>
  );
}
