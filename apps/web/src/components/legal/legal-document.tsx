import type { ReactNode } from "react";

/** Long-form legal text with readable measure, numbered sections and a version footer. */
export function LegalDocument({
  title,
  intro,
  version,
  children,
}: {
  title: string;
  intro?: ReactNode;
  version: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 pt-8 pb-20 lg:pt-14">
      <h1 className="text-display font-extrabold text-balance">{title}</h1>
      {intro ? <div className="mt-3 text-body text-fg-muted">{intro}</div> : null}
      <div className="legal [&_h2]:text-title-lg mt-10 space-y-9 text-body leading-7 [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-3 [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_table]:w-full [&_table]:text-body-sm [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-2 [&_th]:text-left [&_th]:text-caption [&_th]:text-fg-muted [&_ul]:mt-2 [&_ul]:space-y-1.5">
        {children}
      </div>
      <p className="mt-12 border-t border-line pt-5 text-caption text-fg-subtle">Versione {version}</p>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
