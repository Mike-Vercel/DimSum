"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-routing";
import { PasswordInput } from "./password-input";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!token || params.get("error")) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-warning-soft text-warning">
          <TriangleAlert className="size-8" />
        </span>
        <p className="text-body text-fg-muted">
          Il link per reimpostare la password è scaduto o è già stato usato.
        </p>
        <Button asChild size="lg" block>
          <Link href="/password-dimenticata">Richiedi un nuovo link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-8" />
        </span>
        <p className="text-body text-fg-muted">
          Password aggiornata. Per sicurezza abbiamo chiuso le sessioni aperte sugli altri dispositivi.
        </p>
        <Button asChild size="xl" block className="h-14">
          <Link href="/login">Accedi</Link>
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
        if (password.length < 10) {
          setError("Almeno 10 caratteri.");
          return;
        }
        setError(null);
        setFailure(null);
        setBusy(true);
        const res = await authClient.resetPassword({ newPassword: password, token });
        setBusy(false);
        if (res.error) setFailure(authErrorMessage(res.error));
        else setDone(true);
      }}
    >
      <Field label="Nuova password" error={error} hint="Almeno 10 caratteri.">
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      {failure ? <InlineAlert tone="danger" title={failure} /> : null}
      <Button type="submit" size="xl" block className="h-14" loading={busy}>
        Salva la nuova password
      </Button>
    </form>
  );
}
