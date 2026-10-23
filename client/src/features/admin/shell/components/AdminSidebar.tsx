"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/cn";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { AdminCloseIcon, AdminLogoutIcon } from "./icons";
import { ADMIN_NAV_ITEMS } from "../config/nav";

interface AdminSidebarProps {
  adminName?: string;
  onLogout: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}

export function AdminSidebar({
  adminName,
  onLogout,
  onNavigate,
  onClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="mb-6 flex items-center justify-between gap-3 px-2">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo className="h-8 shrink-0 lg:h-10" />
          <div className="min-w-0 border-s border-border ps-3">
            <div className="truncate text-base font-extrabold text-foreground">
              لوحة الأدمن
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {adminName ?? "مدير المنصة"}
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <AdminCloseIcon />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {ADMIN_NAV_ITEMS.map((item, index) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          // Print the heading on the first item of each run of a group.
          const groupHeading =
            item.group && item.group !== ADMIN_NAV_ITEMS[index - 1]?.group
              ? item.group
              : null;
          return (
            <Fragment key={item.href}>
              {groupHeading ? (
                <div className="px-3 pb-1 pt-4 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground/70">
                  {groupHeading}
                </div>
              ) : null}
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon />
                <span className="truncate">{item.label}</span>
              </Link>
            </Fragment>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border/60 pt-3">
        <ThemeToggle variant="label" />
        <button
          onClick={onLogout}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <AdminLogoutIcon />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
