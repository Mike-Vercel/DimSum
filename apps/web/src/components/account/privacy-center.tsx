"use client";

import type { ConsentType, MeDTO } from "@dimsum/types";
import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { useCart } from "@/lib/stores/cart";
import { useCheckoutDraft } from "@/lib/stores/checkout";
import { useOrderPrefs } from "@/lib/stores/order-prefs";

const MARKETING: { type: ConsentType; title: string; description: string }[] = [
  {
    type: "MARKETING_EMAIL",
    title: "Offerte e novità via e-mail",
    description: "Promozioni, nuovi piatti ed eventi del locale.",
  },
  {
    type: "MARKETING_PUSH",
    title: "Offerte via notifica",
    description: "Promozioni sulle notifiche del dispositivo. Gli avvisi sugli ordini restano sempre attivi.",
  },
];

export function PrivacyCenter({ me }: { me: MeDTO }) {
  const router = useRouter();
  const [consents, setConsents] = useState(me.consents);
  const [saving, setSaving] = useState<ConsentType | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const toggle = async (type: ConsentType, granted: boolean) => {
    setSaving(type);
    setConsents((c) => ({ ...c, [type]: granted }));
    try {
      const updated = await api.me.consents({ consents: [{ type, granted }] });
      setConsents(updated.consents);
      toast.success(granted ? "Preferenza attivata" : "Preferenza disattivata");
    } catch {
      setConsents((c) => ({ ...c, [type]: !granted }));
      toast.error("Non è stato possibile salvare. Riprova.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <h2 className="text-title font-bold">Comunicazioni promozionali</h2>
        <p className="mt-1 text-body-sm text-fg-muted">
          Facoltative e revocabili in ogni momento. Non usiamo i tuoi dati per profilazione.
        </p>
        <ul className="mt-5 divide-y divide-line">
          {MARKETING.map((m) => (
            <li key={m.type} className="flex items-center justify-between gap-5 py-4 first:pt-0 last:pb-0">
              <label htmlFor={`consent-${m.type}`} className="min-w-0 cursor-pointer">
                <span className="block font-semibold">{m.title}</span>
                <span className="block text-body-sm text-fg-muted">{m.description}</span>
              </label>
              <Switch
                id={`consent-${m.type}`}
                checked={consents[m.type]}
                disabled={saving === m.type}
                onCheckedChange={(v) => void toggle(m.type, v)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <h2 className="text-title font-bold">I tuoi dati</h2>
        <p className="mt-1 text-body-sm text-fg-muted">
          Scarica una copia di tutto ciò che conserviamo su di te: profilo, indirizzi, ordini, consensi.
          Dettagli nell&apos;
          <Link href="/privacy" className="font-semibold text-fg underline underline-offset-4">
            Informativa privacy
          </Link>
          .
        </p>
        <Button asChild variant="secondary" className="mt-5">
          <a href="/api/v1/me/export" download>
            <Download className="size-4.5" /> Scarica i miei dati
          </a>
        </Button>
      </section>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-danger/30 sm:p-6">
        <h2 className="text-title font-bold">Elimina account</h2>
        <p className="mt-1 text-body-sm text-fg-muted">
          Cancelliamo profilo, indirizzi, preferiti e punti. Gli ordini restano nei nostri registri contabili
          come richiesto dalla legge, senza i tuoi dati di contatto.
        </p>
        <Button variant="danger" className="mt-5" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4.5" /> Elimina il mio account
        </Button>
      </section>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setConfirmation("");
            setDeleteError(null);
          }
        }}
        title="Eliminare definitivamente l'account?"
        description="L'operazione non si può annullare."
        size="sm"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              disabled={confirmation.trim().toUpperCase() !== "ELIMINA"}
              loading={deleting}
              onClick={async () => {
                setDeleting(true);
                setDeleteError(null);
                try {
                  await api.me.deleteAccount();
                  useCart.getState().clear();
                  useCheckoutDraft.getState().forget();
                  useOrderPrefs.getState().setAddress(null);
                  toast("Account eliminato", { description: "Ci dispiace vederti andare via. A presto!" });
                  router.replace("/");
                  router.refresh();
                } catch (error) {
                  setDeleteError(
                    error instanceof ApiError ? error.message : "Eliminazione non riuscita. Riprova.",
                  );
                  setDeleting(false);
                }
              }}
            >
              Elimina
            </Button>
          </div>
        }
      >
        <div className="space-y-4 px-6 pb-4">
          <Field label='Scrivi "ELIMINA" per confermare'>
            {(p) => (
              <Input
                {...p}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
              />
            )}
          </Field>
          {deleteError ? <InlineAlert tone="danger" title={deleteError} /> : null}
        </div>
      </Dialog>
    </div>
  );
}
