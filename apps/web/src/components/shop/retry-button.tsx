"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  return (
    <Button size="lg" className="mt-8" onClick={() => window.location.reload()}>
      <RotateCcw className="size-4.5" /> Riprova
    </Button>
  );
}
