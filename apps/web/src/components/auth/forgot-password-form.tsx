"use client";

import { email as emailSchema } from "@dimsum/validation";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-routing";

/** Always answers the same way, whether or not the address has an account (no account discovery). */
export function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success">
          <MailCheck className="size-8" />
        </span>
        <p className="text-body text-fg-muted">
          Se esiste un account per <strong className="text-fg">{email}</strong>, riceverai a breve un link per
          scegliere una nuova password. Il link vale un&apos;ora.
        </p>
        <Button asChild variant="secondary" size="lg" block>
          <Link href="/login">Torna all&apos;accesso</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const parsed = emailSchema.safeParse(email);
        if (!parsed.success) {
          setError("Inserisci un indirizzo e-mail valido.");
          return;
        }
        setError(null);
        setFailure(null);
        setBusy(true);
        const res = await authClient.requestPasswordReset({
          email: parsed.data,
          redirectTo: "/reimposta-password",
        });
        setBusy(false);
        if (res.error && res.error.status === 429) setFailure(authErrorMessage(res.error));
        else setSent(true);
      }}
    >
      <Field label="E-mail dell'account" error={error}>
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
      {failure ? <InlineAlert tone="danger" title={failure} /> : null}
      <Button type="submit" size="xl" block className="h-14" loading={busy}>
        Invia il link
      </Button>
      <p className="text-center text-body-sm">
        <Link
          href="/login"
          className="font-semibold text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Torna all&apos;accesso
        </Link>
      </p>
    </form>
  );
}
