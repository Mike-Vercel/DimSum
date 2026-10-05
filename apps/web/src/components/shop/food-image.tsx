import type { ImageDTO } from "@dimsum/types";
import { UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Product photo with art direction driven by the photo itself: food shot on a dark set fills the
 * frame, packshots on white (drinks, desserts) are contained on a light surface.
 */
export function FoodImage({
  image,
  sizes,
  priority = false,
  className,
  imgClassName,
  rounded = "rounded-lg",
  fit,
}: {
  image: ImageDTO | null;
  sizes: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  rounded?: string;
  fit?: "cover" | "contain";
}) {
  if (!image) {
    return (
      <div className={cn("grid place-items-center bg-surface-3 text-fg-subtle", rounded, className)}>
        <UtensilsCrossed className="size-1/4 max-h-10 max-w-10" strokeWidth={1.4} aria-hidden />
      </div>
    );
  }
  const light = image.backdrop === "LIGHT";
  const mode = fit ?? (light ? "contain" : "cover");
  return (
    <div
      className={cn("relative overflow-hidden", rounded, light ? "bg-white" : "bg-ink-900", className)}
      style={!light && image.dominantColor ? { backgroundColor: image.dominantColor } : undefined}
    >
      <Image
        src={image.url}
        alt={image.alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={75}
        placeholder={image.blurDataUrl ? "blur" : "empty"}
        blurDataURL={image.blurDataUrl ?? undefined}
        className={cn(
          "transition-transform duration-500 ease-[var(--ease-out-quint)]",
          mode === "contain" ? "object-contain p-[8%]" : "object-cover",
          imgClassName,
        )}
      />
    </div>
  );
}
