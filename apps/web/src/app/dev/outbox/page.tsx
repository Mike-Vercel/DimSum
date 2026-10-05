import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { db } from "@/server/db";
import { isProduction } from "@/server/env";

export const metadata: Metadata = { title: "Outbox e-mail", robots: { index: false, follow: false } };

const when = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Links in the message (verification, password reset, tracking), clickable outside the preview. */
function linksOf(html: string): string[] {
  const hrefs = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]!.replaceAll("&amp;", "&"));
  return [...new Set(hrefs)];
}

async function Outbox({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  await connection();
  // Development tool: messages stay on this machine (EMAIL_PROVIDER=outbox). Never in production.
  if (isProduction()) notFound();
  const { id } = await searchParams;
  const emails = await db.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, to: true, subject: true, template: true, createdAt: true },
  });
  const selectedId = (typeof id === "string" ? id : null) ?? emails[0]?.id ?? null;
  const selected = selectedId
    ? await db.emailLog.findUnique({
        where: { id: selectedId },
        select: { to: true, subject: true, html: true },
      })
    : null;

  if (emails.length === 0) {
    return (
      <p className="rounded-2xl bg-surface p-6 text-body-sm text-fg-muted ring-1 ring-line">
        Nessuna e-mail ancora: registrati o fai un ordine e torna qui.
      </p>
    );
  }
  const html = selected?.html ?? null;
  const links = html ? linksOf(html) : [];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <ul className="divide-y divide-line self-start overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {emails.map((e) => (
          <li key={e.id}>
            <Link
              href={`/dev/outbox?id=${e.id}`}
              className={cn(
                "block px-4 py-3 hover:bg-surface-2",
                e.id === selectedId && "bg-brand-soft hover:bg-brand-soft",
              )}
            >
              <p className="truncate text-body-sm font-semibold">{e.subject}</p>
              <p className="truncate text-caption text-fg-muted">
                {e.to} · {when.format(e.createdAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <section className="min-w-0 space-y-3">
        {selected ? (
          <>
            <div>
              <h2 className="text-title-sm font-bold">{selected.subject}</h2>
              <p className="text-body-sm text-fg-muted">A: {selected.to}</p>
            </div>
            {links.length ? (
              <ul className="space-y-1 rounded-2xl bg-surface p-4 ring-1 ring-line">
                {links.map((href) => (
                  <li key={href} className="truncate text-caption">
                    <a href={href} className="font-semibold text-brand-ink underline underline-offset-2">
                      {href}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {html ? (
              <iframe
                title={`Anteprima: ${selected.subject}`}
                srcDoc={html.replace(/<head([^>]*)>/i, '<head$1><base target="_blank">')}
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                className="h-[75dvh] w-full rounded-2xl bg-white ring-1 ring-line"
              />
            ) : (
              <p className="text-body-sm text-fg-muted">
                Contenuto non salvato (inviata con un provider reale).
              </p>
            )}
          </>
        ) : (
          <p className="text-body-sm text-fg-muted">E-mail non trovata.</p>
        )}
      </section>
    </div>
  );
}

export default function OutboxPage({ searchParams }: PageProps<"/dev/outbox">) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
      <div>
        <h1 className="text-headline font-extrabold">Outbox e-mail</h1>
        <p className="text-body-sm text-fg-muted">
          Solo in sviluppo: con EMAIL_PROVIDER=outbox nessuna e-mail esce dal computer. Qui trovi i link di
          verifica e di reimpostazione password.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Outbox searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
