"use client";

import type { ProductDTO } from "@dimsum/types";
import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import { Drawer } from "vaul";
import { useIsDesktop } from "@/lib/use-media-query";
import { ProductDetail } from "./product-detail";

/** Bottom sheet on phones, centered dialog on tablet/desktop. */
export function ProductSheet({
  product,
  bestseller,
  onClose,
}: {
  product: ProductDTO | null;
  bestseller: boolean;
  onClose: () => void;
}) {
  const desktop = useIsDesktop();
  const open = product !== null;

  if (desktop) {
    return (
      <RadixDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
          <RadixDialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,900px)] w-[min(560px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-canvas shadow-lg outline-none data-[state=open]:animate-fade-in">
            <RadixDialog.Title className="sr-only">{product?.name ?? "Prodotto"}</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">Dettaglio prodotto</RadixDialog.Description>
            <RadixDialog.Close
              aria-label="Chiudi"
              className="absolute top-4 left-4 z-20 grid size-10 tap place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
            >
              <X className="size-5" />
            </RadixDialog.Close>
            <div className="min-h-0 flex-1 overflow-y-auto pt-3">
              {product ? (
                <ProductDetail key={product.id} product={product} bestseller={bestseller} onAdded={onClose} />
              ) : null}
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-3xl bg-canvas shadow-sheet outline-none">
          <div className="mx-auto mt-2.5 mb-2 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />
          <Drawer.Title className="sr-only">{product?.name ?? "Prodotto"}</Drawer.Title>
          <Drawer.Description className="sr-only">Dettaglio prodotto</Drawer.Description>
          <Drawer.Close
            aria-label="Chiudi"
            className="absolute top-7 left-6 z-20 grid size-10 tap place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
          >
            <X className="size-5" />
          </Drawer.Close>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {product ? (
              <ProductDetail key={product.id} product={product} bestseller={bestseller} onAdded={onClose} />
            ) : null}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
