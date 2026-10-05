"use client";

import { Heart } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/cn";
import { useFavorites } from "@/lib/favorites";
import { haptics } from "@/lib/haptics";
import { spring } from "@/lib/motion";

export function FavoriteButton({
  productId,
  productName,
  variant = "plain",
  className,
}: {
  productId: string;
  productName: string;
  variant?: "plain" | "glass";
  className?: string;
}) {
  const fav = useFavorites();
  const router = useRouter();
  const active = fav.isFavorite(productId);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Rimuovi ${productName} dai preferiti` : `Aggiungi ${productName} ai preferiti`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!fav.signedIn) {
          toast("Salva i tuoi piatti preferiti", {
            description: "Accedi o crea un account: li ritrovi su tutti i tuoi dispositivi.",
            action: {
              label: "Accedi",
              onClick: () => router.push(`/login?next=${encodeURIComponent(location.pathname)}`),
            },
          });
          return;
        }
        haptics.select();
        fav.toggle(productId);
      }}
      className={cn(
        "grid size-10 tap place-items-center rounded-full",
        variant === "glass" ? "bg-black/40 text-white backdrop-blur-md" : "text-fg-subtle hover:text-brand",
        className,
      )}
    >
      <motion.span
        key={String(active)}
        initial={{ scale: active ? 0.6 : 1 }}
        animate={{ scale: 1 }}
        transition={spring.pop}
      >
        <Heart className={cn("size-5", active && "fill-brand text-brand")} />
      </motion.span>
    </button>
  );
}
