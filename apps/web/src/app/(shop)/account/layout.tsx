import { AccountSidebar } from "@/components/account/account-nav";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-28 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:pt-10 lg:pb-20">
      <AccountSidebar />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
