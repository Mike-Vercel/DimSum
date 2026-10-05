import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Il tuo carrello",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartView />;
}
