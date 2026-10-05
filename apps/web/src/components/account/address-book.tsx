"use client";

import type { SavedAddressDTO } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, House, MapPin, MoreHorizontal, Plus } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { AddressPicker } from "@/components/address/address-picker";
import { Badge, Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useOrderPrefs, type DeliveryAddress } from "@/lib/stores/order-prefs";

const PRESET_LABELS = ["Casa", "Lavoro"] as const;
const key = ["me", "addresses"] as const;

function iconFor(label: string | null) {
  if (label === "Casa") return <House className="size-5" />;
  if (label === "Lavoro") return <Briefcase className="size-5" />;
  return <MapPin className="size-5" />;
}

function detailsLine(a: SavedAddressDTO): string {
  return [
    a.staircase && `Scala ${a.staircase}`,
    a.floor && `Piano ${a.floor}`,
    a.apartment && `Int. ${a.apartment}`,
    a.intercom && `Citofono ${a.intercom}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function toDeliveryAddress(a: SavedAddressDTO): DeliveryAddress {
  return { ...a, savedAddressId: a.id };
}

function toInput(a: DeliveryAddress, label: string | null, isDefault: boolean) {
  return {
    label,
    isDefault,
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
  };
}

/** Editor: the shared address picker (search, map pin, rider details, zone check), then a label. */
function AddressEditor({
  open,
  onOpenChange,
  editing,
  isFirst,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SavedAddressDTO | null;
  isFirst: boolean;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<DeliveryAddress | null>(null);
  const [label, setLabel] = useState<string>(editing?.label ?? "");
  const [isDefault, setIsDefault] = useState(editing?.isDefault ?? isFirst);

  const save = useMutation({
    mutationFn: (address: DeliveryAddress) => {
      const input = toInput(address, label.trim() || null, isDefault);
      return editing ? api.me.addresses.update(editing.id, input) : api.me.addresses.create(input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success(editing ? "Indirizzo aggiornato" : "Indirizzo salvato");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Salvataggio non riuscito."),
  });

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Modifica indirizzo" : "Nuovo indirizzo"}
      keepFieldCentered
      footer={
        picked ? (
          <Button size="lg" block loading={save.isPending} onClick={() => save.mutate(picked)}>
            Salva indirizzo
          </Button>
        ) : undefined
      }
    >
      {picked ? (
        <div className="space-y-5 px-5 pb-6">
          <div className="flex items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
            <MapPin className="mt-0.5 size-5 text-brand" />
            <div className="min-w-0">
              <p className="font-semibold">
                {picked.street} {picked.streetNumber}
              </p>
              <p className="text-body-sm text-fg-muted">{picked.formatted}</p>
              <button
                type="button"
                className="mt-1 text-body-sm font-semibold underline underline-offset-4"
                onClick={() => setPicked(null)}
              >
                Cambia
              </button>
            </div>
          </div>
          <div className="space-y-2.5">
            <p className="text-body-sm font-semibold">Etichetta</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_LABELS.map((l) => (
                <Chip key={l} selected={label === l} onClick={() => setLabel(label === l ? "" : l)}>
                  {l}
                </Chip>
              ))}
            </div>
            <Field label="Oppure scrivi tu" optional>
              {(p) => (
                <Input
                  {...p}
                  value={PRESET_LABELS.includes(label as (typeof PRESET_LABELS)[number]) ? "" : label}
                  maxLength={40}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Es. Casa dei nonni"
                />
              )}
            </Field>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line">
            <span>
              <span className="block font-semibold">Indirizzo predefinito</span>
              <span className="block text-caption text-fg-muted">Proposto per primo quando ordini</span>
            </span>
            <Switch checked={isDefault} disabled={editing?.isDefault} onCheckedChange={setIsDefault} />
          </label>
        </div>
      ) : (
        <AddressPicker
          initial={editing ? toDeliveryAddress(editing) : null}
          confirmLabel="Continua"
          onConfirm={(address) => setPicked(address)}
        />
      )}
    </ResponsiveSheet>
  );
}

export function AddressBook({ initial }: { initial: SavedAddressDTO[] }) {
  const qc = useQueryClient();
  const setAddress = useOrderPrefs((s) => s.setAddress);
  const setFulfillment = useOrderPrefs((s) => s.setFulfillment);
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => api.me.addresses.list(),
    initialData: { addresses: initial },
    initialDataUpdatedAt: 0,
  });
  const [editor, setEditor] = useState<{ open: boolean; editing: SavedAddressDTO | null; version: number }>({
    open: false,
    editing: null,
    version: 0,
  });
  const [toDelete, setToDelete] = useState<SavedAddressDTO | null>(null);
  const addresses = data.addresses;

  const openEditor = (editing: SavedAddressDTO | null) =>
    setEditor((e) => ({ open: true, editing, version: e.version + 1 }));

  const makeDefault = useMutation({
    mutationFn: (a: SavedAddressDTO) =>
      api.me.addresses.update(a.id, toInput(toDeliveryAddress(a), a.label, true)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: () => toast.error("Operazione non riuscita. Riprova."),
  });
  const remove = useMutation({
    mutationFn: (a: SavedAddressDTO) => api.me.addresses.remove(a.id),
    onSuccess: () => {
      setToDelete(null);
      void qc.invalidateQueries({ queryKey: key });
      toast("Indirizzo eliminato");
    },
    onError: () => toast.error("Eliminazione non riuscita. Riprova."),
  });

  return (
    <div className="space-y-4">
      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Nessun indirizzo salvato"
          description="Salva casa o ufficio: al prossimo ordine basta un tocco."
          action={
            <Button onClick={() => openEditor(null)}>
              <Plus className="size-4.5" /> Aggiungi indirizzo
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 xl:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="flex items-start gap-3.5 rounded-2xl bg-surface p-4 ring-1 ring-line">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2">
                  {iconFor(a.label)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {a.label ?? `${a.street} ${a.streetNumber}`}
                    {a.isDefault ? (
                      <Badge tone="brand" size="sm">
                        Predefinito
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-body-sm text-fg-muted">
                    {a.label ? a.formatted : `${a.postalCode} ${a.city}`}
                  </p>
                  {detailsLine(a) ? (
                    <p className="mt-0.5 text-caption text-fg-subtle">{detailsLine(a)}</p>
                  ) : null}
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger
                    aria-label={`Azioni per ${a.label ?? a.street}`}
                    className="grid size-9 shrink-0 tap place-items-center rounded-full hover:bg-surface-2"
                  >
                    <MoreHorizontal className="size-5" />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="z-50 min-w-52 rounded-xl bg-canvas p-1.5 shadow-lg ring-1 ring-line"
                    >
                      {[
                        {
                          label: "Usa per ordinare",
                          run: () => {
                            setFulfillment("DELIVERY");
                            setAddress(toDeliveryAddress(a));
                            toast.success(`Consegna a ${a.street} ${a.streetNumber}`);
                          },
                        },
                        { label: "Modifica", run: () => openEditor(a) },
                        ...(a.isDefault
                          ? []
                          : [{ label: "Imposta come predefinito", run: () => makeDefault.mutate(a) }]),
                        { label: "Elimina", run: () => setToDelete(a), danger: true },
                      ].map((item) => (
                        <DropdownMenu.Item
                          key={item.label}
                          onSelect={item.run}
                          className={cn(
                            "cursor-pointer rounded-lg px-3 py-2.5 text-body-sm font-medium outline-none data-[highlighted]:bg-surface-2",
                            "danger" in item && "text-danger",
                          )}
                        >
                          {item.label}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </li>
            ))}
          </ul>
          <Button variant="secondary" block className="sm:w-auto" onClick={() => openEditor(null)}>
            <Plus className="size-4.5" /> Aggiungi indirizzo
          </Button>
        </>
      )}

      <AddressEditor
        key={editor.version}
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        editing={editor.editing}
        isFirst={addresses.length === 0}
      />

      <Dialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminare questo indirizzo?"
        description={toDelete ? toDelete.formatted : undefined}
        size="sm"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => toDelete && remove.mutate(toDelete)}
            >
              Elimina
            </Button>
          </div>
        }
      >
        <p className="px-6 pb-4 text-body-sm text-fg-muted">
          Gli ordini già fatti a questo indirizzo non cambiano.
        </p>
      </Dialog>
    </div>
  );
}
