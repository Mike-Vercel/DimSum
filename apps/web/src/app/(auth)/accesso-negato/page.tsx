import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SwitchAccountButton } from "@/components/auth/switch-account-button";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Accesso non consentito",
  robots: { index: false, follow: false },
};

export default function AccessDeniedPage() {
  return (
    <>
      <span className="mb-6 grid size-16 place-items-center rounded-full bg-warning-soft text-warning">
        <ShieldAlert className="size-8" />
      </span>
      <AuthHeading
        title="Quest'area non è per il tuo account"
        description="Se fai parte dello staff, accedi con l'account che ti ha dato il ristorante."
      />
      <div className="grid gap-3">
        <Button asChild size="xl" block className="h-14">
          <Link href="/">Torna alla home</Link>
        </Button>
        <SwitchAccountButton />
      </div>
    </>
  );
}
