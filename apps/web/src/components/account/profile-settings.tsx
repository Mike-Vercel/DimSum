"use client";

import type { MeDTO } from "@dimsum/types";
import { phone as phoneSchema, personName } from "@dimsum/validation";
import { Check, KeyRound, LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { GoogleIcon } from "@/components/brand/provider-icons";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { authClient, useSession } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-routing";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 className="text-title font-bold">{title}</h2>
      {description ? <p className="mt-1 text-body-sm text-fg-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DetailsForm({ me, askBirthday }: { me: MeDTO; askBirthday: boolean }) {
  const { refetch } = useSession();
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [birthDate, setBirthDate] = useState(me.birthDate ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        const n = personName.safeParse(name);
        if (!n.success) next.name = n.error.issues[0]?.message ?? "Nome non valido.";
        const p = phone.trim() ? phoneSchema.safeParse(phone) : null;
        if (p && !p.success) next.phone = p.error.issues[0]?.message ?? "Numero non valido.";
        setErrors(next);
        if (Object.keys(next).length) return;
        setBusy(true);
        try {
          await api.me.update({
            name,
            phone: phone.trim() ? phone : null,
            birthDate: askBirthday && birthDate ? birthDate : (me.birthDate ?? null),
          });
          // The session keeps a short-lived copy of the profile: refresh it so the new name shows everywhere.
          await authClient.getSession({ query: { disableCookieCache: true } });
          await refetch();
          toast.success("Dati aggiornati");
        } catch (error) {
          if (error instanceof ApiError && error.fieldErrors)
            setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0] ?? ""])));
          toast.error(error instanceof ApiError ? error.message : "Salvataggio non riuscito.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Nome e cognome" error={errors.name} className="sm:col-span-2">
        {(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="E-mail" hint="Per cambiarla scrivici dall'assistenza.">
        {(p) => <Input {...p} value={me.email} readOnly disabled />}
      </Field>
      <Field label="Telefono" optional error={errors.phone} hint="Solo per comunicazioni sui tuoi ordini.">
        {(p) => (
          <Input
            {...p}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+39 333 123 4567"
          />
        )}
      </Field>
      {askBirthday ? (
        <Field
          label="Data di nascita"
          optional
          error={errors.birthDate}
          hint="Per un regalo del Club nel giorno del tuo compleanno."
        >
          {(p) => (
            <Input
              {...p}
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          )}
        </Field>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" loading={busy}>
          Salva modifiche
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (next.length < 10) {
          setError("La nuova password deve avere almeno 10 caratteri.");
          return;
        }
        setError(null);
        setBusy(true);
        const res = await authClient.changePassword({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        });
        setBusy(false);
        if (res.error) {
          setError(
            res.error.code === "INVALID_PASSWORD"
              ? "La password attuale non è corretta."
              : authErrorMessage(res.error),
          );
          return;
        }
        setCurrent("");
        setNext("");
        toast.success("Password aggiornata", {
          description: "Abbiamo chiuso le sessioni sugli altri dispositivi.",
        });
      }}
    >
      <Field label="Password attuale">
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
      </Field>
      <Field label="Nuova password" hint="Almeno 10 caratteri.">
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        )}
      </Field>
      {error ? <InlineAlert tone="danger" title={error} className="sm:col-span-2" /> : null}
      <div className="sm:col-span-2">
        <Button type="submit" variant="secondary" loading={busy}>
          <KeyRound className="size-4.5" /> Aggiorna password
        </Button>
      </div>
    </form>
  );
}

export function ProfileSettings({
  me,
  methods,
  askBirthday,
  googleAvailable,
}: {
  me: MeDTO;
  methods: string[];
  askBirthday: boolean;
  googleAvailable: boolean;
}) {
  const [linking, setLinking] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const hasPassword = methods.includes("credential");
  const hasGoogle = methods.includes("google");

  return (
    <div className="space-y-5">
      <Section title="Profilo">
        <DetailsForm me={me} askBirthday={askBirthday} />
      </Section>

      <Section title="Accesso e sicurezza">
        <div className="space-y-6">
          {hasPassword ? (
            <PasswordForm />
          ) : (
            <p className="text-body-sm text-fg-muted">
              Accedi con il tuo account Google: nessuna password da ricordare.
            </p>
          )}

          {googleAvailable ? (
            <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 p-4">
              <span className="flex items-center gap-3">
                <GoogleIcon className="size-5" />
                <span className="text-body-sm font-semibold">Google</span>
              </span>
              {hasGoogle ? (
                <span className="flex items-center gap-1.5 text-body-sm font-semibold text-success">
                  <Check className="size-4" /> Collegato
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={linking}
                  onClick={async () => {
                    setLinking(true);
                    const res = await authClient.linkSocial({
                      provider: "google",
                      callbackURL: "/account/profilo",
                    });
                    if (res.error) {
                      setLinking(false);
                      toast.error("Collegamento non riuscito", {
                        description: "Usa un account Google con la stessa e-mail.",
                      });
                    }
                  }}
                >
                  Collega
                </Button>
              )}
            </div>
          ) : null}

          <div className="border-t border-line pt-5">
            <Button
              variant="ghost"
              loading={revoking}
              onClick={async () => {
                setRevoking(true);
                const res = await authClient.revokeOtherSessions();
                setRevoking(false);
                if (res.error) toast.error("Operazione non riuscita. Riprova.");
                else toast.success("Fatto", { description: "Sei uscito da tutti gli altri dispositivi." });
              }}
            >
              <LogOut className="size-4.5" /> Esci da tutti gli altri dispositivi
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
