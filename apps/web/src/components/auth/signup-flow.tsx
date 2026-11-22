"use client";

import type { DeliveryQuoteDTO } from "@dimsum/types";
import { email as emailSchema } from "@dimsum/validation";
import { ArrowLeft, Mail, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AddressPicker } from "@/components/address/address-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Divider } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { api, ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { ProviderButton } from "@/lib/auth-providers";
import { authErrorMessage, safeNext } from "@/lib/auth-routing";
import { cn } from "@/lib/cn";
import { haptics } from "@/lib/haptics";
import { useOrderPrefs, type DeliveryAddress } from "@/lib/stores/order-prefs";
import { PasswordInput } from "./password-input";
import { SocialButtons } from "./social-buttons";

type Step = "start" | "email" | "code" | "profile" | "address";
const STEPS: Step[] = ["email", "code", "profile", "address"];
const MIN_PASSWORD = 10;
const RESEND_SECONDS = 30;

/**
 * Sign-up: Google, or the e-mail with a 6-digit code (no link to click, no password to invent
 * first). The code creates the account already verified; then name, surname and password, then the
 * delivery address (skippable). The phone is asked at checkout, when an order needs it.
 */
export function SignupFlow({ google, apple }: { google: ProviderButton; apple: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const orderToClaim = params.get("ordine");
  const destination = next ?? (orderToClaim ? `/order/${orderToClaim}` : "/menu");
  const setPrefsAddress = useOrderPrefs((s) => s.setAddress);

  const [step, setStep] = useState<Step>(params.get("email") ? "email" : "start");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "code") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    codeRef.current?.focus();
    return () => clearInterval(t);
  }, [step]);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const go = (s: Step) => {
    setFailure(null);
    setErrors({});
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finish = async (message: string) => {
    if (orderToClaim) await api.orders.claim(orderToClaim).catch(() => undefined);
    haptics.success();
    toast.success(message);
    router.replace(destination);
    router.refresh();
  };

  const sendCode = async () => {
    const parsed = emailSchema.safeParse(email);
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) nextErrors.email = "Inserisci un indirizzo e-mail valido.";
    if (!terms) nextErrors.terms = "Per creare l'account devi accettare i Termini.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return haptics.error();
    setBusy(true);
    setFailure(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: parsed.data!, type: "sign-in" });
    setBusy(false);
    if (error) {
      haptics.error();
      return setFailure(authErrorMessage(error));
    }
    setEmail(parsed.data!);
    setCode("");
    setResendAt(Date.now() + RESEND_SECONDS * 1000);
    setNow(Date.now());
    go("code");
  };

  const verify = async (value = code) => {
    const otp = value.replace(/\D/g, "");
    if (otp.length !== 6) return setErrors({ code: "Il codice ha 6 cifre." });
    setBusy(true);
    setFailure(null);
    const { data, error } = await authClient.signIn.emailOtp({ email, otp });
    if (error) {
      setBusy(false);
      haptics.error();
      return setFailure(
        error.code === "OTP_EXPIRED"
          ? "Il codice è scaduto: fattene mandare uno nuovo."
          : error.code === "TOO_MANY_ATTEMPTS"
            ? "Troppi tentativi: fattene mandare uno nuovo."
            : error.code === "INVALID_OTP"
              ? "Codice non corretto: controlla l'e-mail e riprova."
              : authErrorMessage(error),
      );
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
    setBusy(false);
    // Someone who already had an account just signed in with the code.
    if (data?.user.name?.trim()) return finish(`Bentornato, ${data.user.name.split(" ")[0]}!`);
    go("profile");
  };

  const saveProfile = async () => {
    const nextErrors: Record<string, string> = {};
    if (!firstName.trim()) nextErrors.firstName = "Inserisci il nome.";
    if (!lastName.trim()) nextErrors.lastName = "Inserisci il cognome.";
    if (password.length < MIN_PASSWORD) nextErrors.password = `Almeno ${MIN_PASSWORD} caratteri.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return haptics.error();
    setBusy(true);
    setFailure(null);
    try {
      await api.me.completeSignup({ firstName: firstName.trim(), lastName: lastName.trim(), password });
      await authClient.getSession({ query: { disableCookieCache: true } });
      go("address");
    } catch (e) {
      haptics.error();
      setFailure(e instanceof ApiError ? e.message : "Qualcosa è andato storto. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  const saveAddress = async (a: DeliveryAddress, quote: DeliveryQuoteDTO) => {
    try {
      await api.me.addresses.create({
        label: "Casa",
        isDefault: true,
        street: a.street,
        streetNumber: a.streetNumber,
        postalCode: a.postalCode,
        city: a.city,
        province: a.province,
        country: a.country,
        formatted: a.formatted,
        location: a.location,
        placeId: a.placeId,
        precision: a.precision,
        staircase: a.staircase,
        floor: a.floor,
        apartment: a.apartment,
        intercom: a.intercom,
        riderNotes: a.riderNotes,
      });
      setPrefsAddress(a, quote);
    } catch {
      toast.error("Non sono riuscito a salvare l'indirizzo: potrai aggiungerlo dal profilo.");
    }
    await finish(`Benvenuto, ${firstName.trim()}!`);
  };

  const current = STEPS.indexOf(step);

  return (
    <div className="space-y-6">
      {step !== "start" ? (
        <div className="flex items-center gap-3">
          {step === "email" || step === "code" ? (
            <button
              type="button"
              onClick={() => go(step === "code" ? "email" : "start")}
              className="grid size-9 tap place-items-center rounded-full bg-surface ring-1 ring-line"
              aria-label="Indietro"
            >
              <ArrowLeft className="size-4.5" />
            </button>
          ) : null}
          <ol className="flex flex-1 gap-1.5" aria-label={`Passo ${current + 1} di ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-500",
                  i <= current ? "bg-brand" : "bg-line",
                )}
              />
            ))}
          </ol>
        </div>
      ) : null}

      {step === "start" ? (
        <div className="space-y-4 auth-step">
          <SocialButtons google={google} apple={apple} callbackURL={destination} googleLabel="Registrati con Google" />
          {google !== "off" || apple ? <Divider label="oppure" /> : null}
          <Button size="xl" block variant="secondary" className="h-14" onClick={() => go("email")}>
            <Mail className="size-5" /> Continua con e-mail
          </Button>
          <p className="text-center text-caption text-fg-muted">
            Ti mandiamo un codice di 6 cifre: niente link da cliccare.
          </p>
        </div>
      ) : null}

      {step === "email" ? (
        <form
          className="space-y-4 auth-step"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <div>
            <h2 className="text-title font-extrabold">La tua e-mail</h2>
            <p className="text-body-sm text-fg-muted">Ti inviamo un codice per confermarla.</p>
          </div>
          <Field label="E-mail" error={errors.email}>
            {(p) => (
              <Input
                {...p}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@esempio.it"
              />
            )}
          </Field>
          <div className="space-y-3">
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
              <Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(v === true)} className="mt-0.5" />
              <span>Voglio ricevere via e-mail offerte e novità di DIMSUM (facoltativo).</span>
            </label>
          </div>
          {failure ? <InlineAlert tone="danger" title={failure} /> : null}
          <Button type="submit" size="xl" block className="h-14" loading={busy}>
            Inviami il codice
          </Button>
        </form>
      ) : null}

      {step === "code" ? (
        <form
          className="space-y-5 auth-step"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <div>
            <h2 className="text-title font-extrabold">Controlla l&apos;e-mail</h2>
            <p className="text-body-sm text-fg-muted">
              Abbiamo mandato un codice di 6 cifre a <strong className="text-fg">{email}</strong>.
            </p>
          </div>
          <Field label="Codice" error={errors.code}>
            {(p) => (
              <Input
                {...p}
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6) void verify(v);
                }}
                placeholder="••••••"
                className="h-16 text-center text-[28px] font-extrabold tracking-[0.5em] tabular-nums"
              />
            )}
          </Field>
          {failure ? <InlineAlert tone="danger" title={failure} /> : null}
          <Button type="submit" size="xl" block className="h-14" loading={busy}>
            Conferma
          </Button>
          <p className="text-center text-body-sm text-fg-muted">
            Non è arrivato? Controlla lo spam oppure{" "}
            <button
              type="button"
              disabled={resendIn > 0 || busy}
              onClick={() => void sendCode()}
              className="font-semibold text-brand-ink underline-offset-4 hover:underline disabled:text-fg-subtle disabled:no-underline"
            >
              {resendIn > 0 ? `rimandalo tra ${resendIn}s` : "rimandalo"}
            </button>
          </p>
        </form>
      ) : null}

      {step === "profile" ? (
        <form
          className="space-y-4 auth-step"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void saveProfile();
          }}
        >
          <div>
            <h2 className="text-title font-extrabold">Come ti chiami?</h2>
            <p className="text-body-sm text-fg-muted">E scegli una password per i prossimi accessi.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" error={errors.firstName}>
              {(p) => (
                <Input
                  {...p}
                  autoComplete="given-name"
                  autoFocus
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              )}
            </Field>
            <Field label="Cognome" error={errors.lastName}>
              {(p) => (
                <Input {...p} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              )}
            </Field>
          </div>
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
          {failure ? <InlineAlert tone="danger" title={failure} /> : null}
          <Button type="submit" size="xl" block className="h-14" loading={busy}>
            Continua
          </Button>
        </form>
      ) : null}

      {step === "address" ? (
        <div className="space-y-4 auth-step">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
              <MapPin className="size-5" />
            </span>
            <div>
              <h2 className="text-title font-extrabold">Dove ti portiamo il cibo?</h2>
              <p className="text-body-sm text-fg-muted">Via, civico, CAP: lo salviamo per i prossimi ordini.</p>
            </div>
          </div>
          <AddressPicker embedded initial={null} confirmLabel="Salva indirizzo" onConfirm={(a, q) => void saveAddress(a, q)} />
          <Button variant="ghost" block onClick={() => void finish(`Benvenuto, ${firstName.trim()}!`)}>
            Salta per ora
          </Button>
        </div>
      ) : null}

      {step === "start" || step === "email" ? (
        <p className="text-center text-body-sm text-fg-muted">
          Hai già un account?{" "}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-brand-ink underline-offset-4 hover:underline"
          >
            Accedi
          </Link>
        </p>
      ) : null}
    </div>
  );
}
