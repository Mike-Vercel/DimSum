import type { ReactNode } from "react";

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-display font-extrabold text-balance">{title}</h1>
      {description ? <p className="mt-2 text-body text-fg-muted">{description}</p> : null}
    </div>
  );
}
