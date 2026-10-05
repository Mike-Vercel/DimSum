"use client";

import { email as emailSchema } from "@dimsum/validation";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Avatar, Divider } from "@/components/ui/misc";
import { signIn, signOut, useSession } from "@/lib/auth-client";
import type { ProviderButton } from "@/lib/auth-providers";
import { authErrorMessage, homeForRole, safeNext } from "@/lib/auth-routing";
import { haptics } from "@/lib/haptics";
import { PasswordInput } from "./password-input";
import { SocialButtons } from "./social-buttons";

export function LoginForm({
  google,
  apple,
  staffArea = false,
}: {
  google: ProviderButton;
  apple: boolean;
  staffArea?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(
    params.get("errore") ? "Accesso con il provider non riuscito. Riprova o usa e-mail e password." : null,
  );
  const [busy, setBusy] = useState(false);

  const registerHref = `/registrati${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const submit = async () => {
    const parsedEmail = emailSchema.safeParse(email);
    const nextErrors = {
      ...(parsedEmail.success ? {} : { email: "Inserisci un indirizzo e-mail valido." }),
      ...(password ? {} : { password: "Inserisci la password." }),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    setFailure(null);
    const { data, error } = await signIn.email({ email: parsedEmail.data!, password, rememberMe: true });
    if (error) {
      haptics.error();
      setFailure(authErrorMessage(error));
      setBusy(false);
      return;
    }
    haptics.success();
    const role = (data?.user as { role?: string } | undefined)?.role;
    router.replace(next ?? homeForRole(role));
    router.refresh();
  };

  if (isPending) return <div className="h-80 skeleton rounded-2xl" aria-hidden />;

  if (session) {
    const role = (session.user as { role?: string }).role;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-4 ring-1 ring-line">
          <Avatar name={session.user.name} src={session.user.image} />
          <div className="min-w-0">
            <p className="font-semibold">Sei già connesso</p>
            <p className="truncate text-body-sm text-fg-muted">{session.user.email}</p>
          </div>
        </div>
        <Button size="xl" block className="h-14" onClick={() => router.replace(next ?? homeForRole(role))}>
          Continua
        </Button>
        <Button
          variant="ghost"
          block
          onClick={async () => {
            await signOut();
            router.refresh();
          }}
        >
          Accedi con un altro account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!staffArea ? <SocialButtons google={google} apple={apple} callbackURL={next ?? "/account"} /> : null}
      {!staffArea && (google !== "off" || apple) ? <Divider label="oppure con la tua e-mail" /> : null}

      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
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
        <Field label="Password" error={errors.password}>
          {(p) => (
            <PasswordInput
              {...p}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <div className="flex justify-end">
          <Link
            href={`/password-dimenticata${email ? `?email=${encodeURIComponent(email)}` : ""}`}
            className="text-body-sm font-semibold text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Password dimenticata?
          </Link>
        </div>
        {failure ? <InlineAlert tone="danger" title={failure} /> : null}
        <Button type="submit" size="xl" block className="h-14" loading={busy}>
          Accedi
        </Button>
      </form>

      {!staffArea ? (
        <p className="text-center text-body-sm text-fg-muted">
          Non hai un account?{" "}
          <Link
            href={registerHref}
            className="font-semibold text-brand-ink underline-offset-4 hover:underline"
          >
            Registrati
          </Link>
        </p>
      ) : null}
    </div>
  );
}
