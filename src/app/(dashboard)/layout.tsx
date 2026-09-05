import { redirect } from "next/navigation";
import { pulseConfig } from "@config/pulse.config";
import { CommandMenu } from "@/components/search/command-menu";
import { Header } from "@/components/layout/header";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { isAuthenticated, isAuthEnabled } from "@/lib/auth";
import { getRepository } from "@/lib/db";
import { isLiveSync, relativeTime } from "@/lib/time/format";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (isAuthEnabled() && !(await isAuthenticated())) {
    redirect("/login");
  }

  const repo = await getRepository();
  const runs = await repo.recentRuns(1);
  const lastSync = runs[0]?.finishedAt ?? runs[0]?.startedAt;
  const live = isLiveSync(lastSync);

  const sidebar = (
    <Sidebar lastSync={lastSync ? relativeTime(lastSync) : undefined} live={live} />
  );

  return (
    <div className="mx-auto min-h-screen max-w-[1440px] border-border lg:border-x">
      <div className="flex min-h-screen">
        <div className="sticky top-0 hidden h-screen flex-none border-r border-border lg:block">
          {sidebar}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Header timezone={pulseConfig.timezone} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <MobileNav />
      <MobileDrawer>{sidebar}</MobileDrawer>
      <CommandMenu />
      <div className="h-14 lg:hidden" />
    </div>
  );
}
