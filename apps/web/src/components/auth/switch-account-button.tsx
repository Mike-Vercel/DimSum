"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function SwitchAccountButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      size="lg"
      block
      onClick={async () => {
        await signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Accedi con un altro account
    </Button>
  );
}
