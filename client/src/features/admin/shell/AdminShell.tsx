"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext";
import { AdminMobileHeader } from "./components/AdminMobileHeader";
import { AdminSidebar } from "./components/AdminSidebar";
import { AdminSidebarDrawer } from "./components/AdminSidebarDrawer";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { admin, logout } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelHistory, setPanelHistory] = useState<string[]>([]);

  const currentPanelLocation = searchParams.size
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Browser history can include the login page or an external site, so it is
  // not enough to check window.history.length. Keep a small in-panel trail and
  // show the button only when the admin actually moved between panel pages.
  useEffect(() => {
    setPanelHistory((current) => {
      if (current.length === 0) return [currentPanelLocation];
      if (current.at(-1) === currentPanelLocation) return current;

      const existingIndex = current.lastIndexOf(currentPanelLocation);
      if (existingIndex >= 0) return current.slice(0, existingIndex + 1);

      return [...current, currentPanelLocation];
    });
  }, [currentPanelLocation]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/admin/login";
  };

  const handleBack = () => {
    if (panelHistory.length > 1) router.back();
  };

  return (
    <div className="min-h-screen bg-background">
      {/*
        The panel chrome is hidden when printing so a printable page (the exam
        generator's paper) comes out on its own, without the nav around it.
      */}
      <div className="print:hidden">
        <AdminMobileHeader onOpenMenu={() => setDrawerOpen(true)} />
      </div>

      <AdminSidebarDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        adminName={admin?.name}
        onLogout={handleLogout}
      />

      <aside className="fixed right-0 top-0 z-40 hidden h-screen w-72 flex-col border-l border-border bg-card/60 backdrop-blur-xl lg:flex print:hidden">
        <AdminSidebar adminName={admin?.name} onLogout={handleLogout} />
      </aside>

      <main className="min-h-[calc(100vh-64px)] min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:mr-72 lg:min-h-screen lg:px-10 lg:py-8 print:mr-0! print:min-h-0 print:p-0!">
        {panelHistory.length > 1 && (
          <div className="mb-5 flex justify-end print:hidden">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-bold text-foreground shadow-soft transition-colors hover:bg-muted"
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
              رجوع
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
