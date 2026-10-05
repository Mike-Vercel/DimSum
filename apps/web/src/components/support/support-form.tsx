"use client";

import { SUPPORT_CATEGORY_LABELS } from "@dimsum/domain";
import type { OrderItemDTO, SupportCategory, SupportTicketDTO } from "@dimsum/types";
import { supportTicketInput } from "@dimsum/validation";
import { Bike, CircleCheck, CreditCard, MessageCircleQuestion, PackageX, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioCard, RadioCardGroup } from "@/components/ui/choice";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { haptics } from "@/lib/haptics";

const CATEGORY_ICONS: Record<SupportCategory, ReactNode> = {
  ORDER_ISSUE: <ReceiptText className="size-4.5" />,
  MISSING_ITEM: <PackageX className="size-4.5" />,
  DELIVERY: <Bike className="size-4.5" />,
  PAYMENT: <CreditCard className="size-4.5" />,
  OTHER: <MessageCircleQuestion className="size-4.5" />,
};

export interface SupportOrderContext {
  publicId: string;
  number: string;
  isDelivery: boolean;
  emailMasked: string;
  items: Pick<OrderItemDTO, "id" | "name" | "quantity">[];
}

/**
 * Support request form. With an order the customer only picks the problem and describes it —
 * contact details come from the order. Without an order (general help) name and e-mail are asked.
 */
export function SupportForm({ order, backHref }: { order?: SupportOrderContext; backHref: string }) {
  const { data: session } = useSession();
  const categories: SupportCategory[] = order
    ? [
        "MISSING_ITEM",
        "ORDER_ISSUE",
        ...(order.isDelivery ? (["DELIVERY"] as const) : []),
        "PAYMENT",
        "OTHER",
      ]
    : ["ORDER_ISSUE", "PAYMENT", "OTHER"];
  const [category, setCategory] = useState<SupportCategory>(categories[0]!);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [otherEmail, setOtherEmail] = useState(false);
  // null = untouched: the field shows the signed-in customer's details until edited.
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SupportTicketDTO | null>(null);

  const askContact = !order || otherEmail;
  const contactName = name ?? session?.user.name ?? "";
  const contactEmail = email ?? session?.user.email ?? "";

  const submit = async () => {
    const flaggedLines =
      order?.items.filter((i) => flagged.includes(i.id)).map((i) => `• ${i.quantity}× ${i.name}`) ?? [];
    const fullMessage =
      category === "MISSING_ITEM" && flaggedLines.length
        ? `Prodotti segnalati:\n${flaggedLines.join("\n")}\n\n${message.trim()}`
        : message.trim();
    const payload = {
      category,
      message: fullMessage,
      orderPublicId: order?.publicId ?? null,
      ...(askContact ? { name: contactName, email: contactEmail } : {}),
    };
    const parsed = supportTicketInput.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      haptics.error();
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      setTicket(await api.support.create(payload));
      haptics.success();
    } catch (error) {
      haptics.error();
      if (error instanceof ApiError && error.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0] ?? ""])));
      }
      setFailure(error instanceof ApiError ? error.message : "Invio non riuscito. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  if (ticket) {
    return (
      <div
        className="flex flex-col items-center rounded-3xl bg-surface px-6 py-10 text-center ring-1 ring-line"
        role="status"
      >
        <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-8" />
        </span>
        <h2 className="text-title-lg mt-5 font-extrabold">Richiesta inviata</h2>
        <p className="mt-2 max-w-sm text-body text-fg-muted">
          Ti risponderemo via e-mail il prima possibile. Conserva il riferimento{" "}
          <strong className="text-fg">{ticket.reference}</strong>.
        </p>
        <Button asChild size="lg" className="mt-7">
          <Link href={backHref}>{order ? "Torna all'ordine" : "Torna al menu"}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-7"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset className="space-y-2.5">
        <legend className="mb-3 text-title font-bold">Di cosa hai bisogno?</legend>
        <RadioCardGroup
          value={category}
          onValueChange={(v) => setCategory(v as SupportCategory)}
          className="grid gap-2.5"
        >
          {categories.map((c) => (
            <RadioCard key={c} value={c} title={SUPPORT_CATEGORY_LABELS[c]} icon={CATEGORY_ICONS[c]} />
          ))}
        </RadioCardGroup>
      </fieldset>

      {order && category === "MISSING_ITEM" ? (
        <fieldset className="space-y-2">
          <legend className="mb-3 text-body font-semibold">Quali prodotti?</legend>
          {order.items.map((item) => {
            const checked = flagged.includes(item.id);
            return (
              <label
                key={item.id}
                className="flex tap cursor-pointer items-center gap-3 rounded-lg bg-surface p-3.5 ring-1 ring-line"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setFlagged((list) => (v ? [...list, item.id] : list.filter((id) => id !== item.id)))
                  }
                />
                <span className="text-body-sm">
                  <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}

      <Field label="Raccontaci cosa è successo" error={errors.message} hint={`${message.trim().length}/4000`}>
        {(p) => (
          <Textarea
            {...p}
            rows={5}
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              category === "MISSING_ITEM"
                ? "Es. nella busta mancava una porzione di gyoza."
                : "Scrivi qui il tuo messaggio."
            }
          />
        )}
      </Field>

      {order && !otherEmail ? (
        <p className="rounded-lg bg-surface-2 p-4 text-body-sm text-fg-muted">
          Ti risponderemo a <strong className="text-fg">{order.emailMasked}</strong>, l&apos;indirizzo usato
          per l&apos;ordine #{order.number}.{" "}
          <button
            type="button"
            className="font-semibold text-fg underline underline-offset-4"
            onClick={() => setOtherEmail(true)}
          >
            Usa un&apos;altra e-mail
          </button>
        </p>
      ) : null}

      {askContact ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" error={errors.name}>
            {(p) => (
              <Input
                {...p}
                value={contactName}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            )}
          </Field>
          <Field label="E-mail" error={errors.email}>
            {(p) => (
              <Input
                {...p}
                type="email"
                inputMode="email"
                value={contactEmail}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            )}
          </Field>
        </div>
      ) : null}

      {failure ? <InlineAlert tone="danger" title={failure} /> : null}

      <Button type="submit" size="xl" block className="h-14" loading={busy}>
        Invia richiesta
      </Button>
    </form>
  );
}
