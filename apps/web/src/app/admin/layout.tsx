import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/shell";
import { Seal } from "@/components/brand/logo";
import { requireStaffPage } from "@/server/auth/session";

export const metadata: Metadata = {
  title: { default: "Gestionale", template: "%s · Gestionale DIMSUM" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0e0d0c" };

async function StaffGate({ children }: { children: React.ReactNode }) {
  const viewer = await requireStaffPage("/admin");
  return (
    <AdminShell viewer={{ userId: viewer.userId, name: viewer.name, email: viewer.email, role: viewer.role }}>
      {children}
    </AdminShell>
  );
}

/** Staff area: every page below is reachable only by STAFF, ADMIN and SUPER_ADMIN accounts. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense
      fallback={
        <div
          className="grid min-h-dvh place-items-center bg-canvas"
          aria-busy="true"
          aria-label="Caricamento del gestionale"
        >
          <Seal className="h-12 animate-pulse text-red-500" />
        </div>
      }
    >
      <StaffGate>{children}</StaffGate>
    </Suspense>
  );
}
