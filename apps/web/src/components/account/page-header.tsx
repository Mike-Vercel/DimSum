import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Title of an account page; on phones it carries the back arrow to the account menu. */
export function AccountPageHeader({
  title,
  description,
  action,
  back = "/account",
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  back?: string;
}) {
  return (
    <header className="mb-6 flex items-start gap-3 lg:mb-8">
      <Link
        href={back}
        aria-label="Indietro"
        className="mt-0.5 grid size-10 shrink-0 tap place-items-center rounded-full bg-surface ring-1 ring-line lg:hidden"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-headline font-extrabold lg:text-display">{title}</h1>
        {description ? <p className="mt-1 text-body-sm text-fg-muted lg:text-body">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
