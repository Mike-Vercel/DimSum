import { AccountCartSync } from "@/components/shop/account-cart-sync";
import { DesktopOnlyOnAppRoutes } from "@/components/shop/app-route-gate";
import { BottomNav } from "@/components/shop/bottom-nav";
import { CartBar } from "@/components/shop/cart-bar";
import { CookieNotice } from "@/components/shop/cookie-notice";
import { ShopFooter } from "@/components/shop/footer";
import { ShopHeader } from "@/components/shop/header";
import { OfflineBanner } from "@/components/shop/offline-banner";
import { CatalogProvider } from "@/components/shop/product-sheet/context";
import { RestaurantProvider } from "@/components/shop/restaurant-context";
import { getCatalog } from "@/server/services/catalog";
import { getRestaurantConfig, toRestaurantInfo } from "@/server/services/restaurant";

/** Customer storefront shell (mobile app layout on phones, editorial layout on desktop). */
export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const [catalog, config] = await Promise.all([getCatalog(), getRestaurantConfig()]);
  const restaurant = toRestaurantInfo(config);
  return (
    <RestaurantProvider value={restaurant}>
      <CatalogProvider initialCatalog={catalog}>
        <AccountCartSync />
        <OfflineBanner />
        <ShopHeader />
        <CookieNotice />
        <main id="contenuto" className="min-h-[60dvh]">
          {children}
        </main>
        <DesktopOnlyOnAppRoutes>
          <ShopFooter restaurant={restaurant} />
        </DesktopOnlyOnAppRoutes>
        <CartBar />
        <BottomNav />
      </CatalogProvider>
    </RestaurantProvider>
  );
}
