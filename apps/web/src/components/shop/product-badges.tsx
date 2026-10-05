import { PRODUCT_TAG_LABELS, SPICY_LEVEL_LABELS } from "@dimsum/domain";
import type { ProductDTO } from "@dimsum/types";
import { Flame, Leaf, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

/** Customer-facing badges: Vegetariano, Piccante, Novità, Più venduto. */
export function ProductBadges({
  product,
  bestseller,
  className,
  size = "sm",
}: {
  product: ProductDTO;
  bestseller?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const items: React.ReactNode[] = [];
  if (bestseller) {
    items.push(
      <Badge key="best" tone="brand" size={size}>
        <TrendingUp aria-hidden /> Più venduto
      </Badge>,
    );
  }
  if (product.tags.includes("NEW")) {
    items.push(
      <Badge key="new" tone="dark" size={size}>
        <Sparkles aria-hidden /> {PRODUCT_TAG_LABELS.NEW}
      </Badge>,
    );
  }
  if (product.tags.includes("VEGAN") || product.tags.includes("VEGETARIAN")) {
    items.push(
      <Badge key="veg" tone="success" size={size}>
        <Leaf aria-hidden />{" "}
        {product.tags.includes("VEGAN") ? PRODUCT_TAG_LABELS.VEGAN : PRODUCT_TAG_LABELS.VEGETARIAN}
      </Badge>,
    );
  }
  if (product.spicyLevel > 0) {
    items.push(
      <Badge key="spicy" tone="warning" size={size} title={SPICY_LEVEL_LABELS[product.spicyLevel]}>
        <span className="flex -space-x-1" aria-hidden>
          {Array.from({ length: product.spicyLevel }, (_, i) => (
            <Flame key={i} />
          ))}
        </span>
        {product.spicyLevel === 1 ? "Leggermente piccante" : PRODUCT_TAG_LABELS.SPICY}
      </Badge>,
    );
  }
  if (items.length === 0) return null;
  return <div className={cn("flex flex-wrap gap-1.5", className)}>{items}</div>;
}
