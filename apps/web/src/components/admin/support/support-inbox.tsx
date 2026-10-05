"use client";

import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from "@dimsum/domain";
import type { AdminSupportTicketDTO, SupportStatus } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Inbox, Mail, Phone, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatOrderDate } from "@/lib/dates";
import { useRealtime } from "@/lib/realtime";
import { AdminPage } from "../ui";

const STATUS_TONE: Record<SupportStatus, "warning" | "info" | "success" | "neutral"> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  CLOSED: "neutral",
};

function Thread({ id, timeZone }: { id: string; timeZone: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: t } = useQuery({
    queryKey: ["admin", "support", "ticket", id],
    queryFn: () => api.admin.support.get(id),
  });
  const [body, setBody] = useState("");
  const [resolve, setResolve] = useState(false);
  const reply = useMutation({
    mutationFn: () =>
      api.admin.support.reply(id, { body: body.trim(), status: resolve ? "RESOLVED" : "IN_PROGRESS" }),
    onSuccess: (ticket) => {
      qc.setQueryData(["admin", "support", "ticket", id], ticket);
      void qc.invalidateQueries({ queryKey: ["admin", "support", "list"] });
      setBody("");
      toast.success("Risposta inviata via e-mail");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Invio non riuscito."),
  });
  const status = useMutation({
    mutationFn: (s: SupportStatus) => api.admin.support.setStatus(id, s),
    onSuccess: (ticket) => {
      qc.setQueryData(["admin", "support", "ticket", id], ticket);
      void qc.invalidateQueries({ queryKey: ["admin", "support", "list"] });
    },
  });
  if (!t) return <div className="h-96 skeleton rounded-2xl" aria-hidden />;
  return (
    <div className="flex h-full flex-col rounded-2xl bg-surface ring-1 ring-line">
      <header className="space-y-2 border-b border-line p-5">
        <button
          type="button"
          onClick={() => router.push("/admin/assistenza")}
          className="mb-1 inline-flex items-center gap-1 text-body-sm text-fg-muted lg:hidden"
        >
          <ArrowLeft className="size-4" /> Richieste
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-title font-bold">{t.subject}</h2>
          <Badge tone={STATUS_TONE[t.status]} size="md">
            {SUPPORT_STATUS_LABELS[t.status]}
          </Badge>
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-fg-muted">
          <span>
            {t.reference} · {SUPPORT_CATEGORY_LABELS[t.category]}
          </span>
          <a href={`mailto:${t.email}`} className="inline-flex items-center gap-1 hover:text-fg">
            <Mail className="size-3.5" /> {t.name} · {t.email}
          </a>
          {t.phone ? (
            <a href={`tel:${t.phone}`} className="inline-flex items-center gap-1 hover:text-fg">
              <Phone className="size-3.5" /> {t.phone}
            </a>
          ) : null}
          {t.order ? (
            <Link href={`/admin/ordini/${t.order.id}`} className="font-semibold text-brand-ink">
              Ordine #{t.order.number}
            </Link>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          {(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as SupportStatus[]).map((s) => (
            <Chip
              key={s}
              selected={t.status === s}
              className="h-8 text-caption"
              onClick={() => status.mutate(s)}
            >
              {SUPPORT_STATUS_LABELS[s]}
            </Chip>
          ))}
        </div>
      </header>
      <ol className="flex-1 space-y-3 overflow-y-auto p-5">
        {t.messages?.map((m) => (
          <li
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-body-sm",
              m.fromStaff ? "ml-auto bg-ink-950 text-white" : "bg-surface-2",
            )}
          >
            <p className="whitespace-pre-line">{m.body}</p>
            <p className={cn("mt-1.5 text-caption", m.fromStaff ? "text-white/60" : "text-fg-subtle")}>
              {m.fromStaff ? (m.authorName ?? "Staff") : t.name} · {formatOrderDate(m.createdAt, timeZone)}
            </p>
          </li>
        ))}
      </ol>
      <form
        className="space-y-3 border-t border-line p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim().length >= 2) reply.mutate();
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={`Rispondi a ${t.name.split(" ")[0]}… (arriva via e-mail)`}
          aria-label="Risposta"
          maxLength={4000}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-body-sm">
            <input
              type="checkbox"
              checked={resolve}
              onChange={(e) => setResolve(e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />{" "}
            Segna come risolta
          </label>
          <Button type="submit" loading={reply.isPending} disabled={body.trim().length < 2}>
            <Send className="size-4" /> Invia risposta
          </Button>
        </div>
      </form>
    </div>
  );
}

export function SupportInbox({
  initial,
  selectedId,
  timeZone,
}: {
  initial: { items: AdminSupportTicketDTO[]; openCount: number };
  selectedId: string | null;
  timeZone: string;
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const { data } = useQuery({
    queryKey: ["admin", "support", "list", filter],
    queryFn: () => api.admin.support.list(filter),
    ...(filter === "open" ? { initialData: { ...initial, nextCursor: null }, initialDataUpdatedAt: 0 } : {}),
  });
  useRealtime(["kitchen"], (e) => {
    if (e.type === "support.created") void qc.invalidateQueries({ queryKey: ["admin", "support"] });
  });
  const tickets = data?.items ?? [];

  return (
    <AdminPage
      title="Assistenza"
      description={`${data?.openCount ?? initial.openCount} richieste da gestire`}
    >
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className={cn("space-y-3", selectedId && "hidden lg:block")}>
          <div className="flex gap-2">
            <Chip selected={filter === "open"} onClick={() => setFilter("open")}>
              Da gestire
            </Chip>
            <Chip selected={filter === "closed"} onClick={() => setFilter("closed")}>
              Archiviate
            </Chip>
          </div>
          {tickets.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={filter === "open" ? "Nessuna richiesta aperta" : "Archivio vuoto"}
            />
          ) : null}
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/assistenza/${t.id}`}
                  className={cn(
                    "block rounded-2xl p-4 ring-1 transition-colors",
                    t.id === selectedId
                      ? "bg-ink-950 text-white ring-ink-950"
                      : "bg-surface ring-line hover:bg-surface-2",
                  )}
                >
                  <p className="flex items-center justify-between gap-2 text-caption">
                    <span className={t.id === selectedId ? "text-white/70" : "text-fg-muted"}>
                      {t.reference} · {formatOrderDate(t.updatedAt, timeZone)}
                    </span>
                    <Badge tone={STATUS_TONE[t.status]}>{SUPPORT_STATUS_LABELS[t.status]}</Badge>
                  </p>
                  <p className="mt-1 font-semibold">{t.subject}</p>
                  <p
                    className={cn(
                      "mt-0.5 line-clamp-2 text-body-sm",
                      t.id === selectedId ? "text-white/70" : "text-fg-muted",
                    )}
                  >
                    {t.name}: {t.lastMessagePreview}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className={cn("min-h-[480px]", !selectedId && "hidden lg:block")}>
          {selectedId ? (
            <Thread key={selectedId} id={selectedId} timeZone={timeZone} />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Seleziona una richiesta"
              description="Le risposte arrivano al cliente via e-mail e restano qui nello storico."
            />
          )}
        </div>
      </div>
    </AdminPage>
  );
}
