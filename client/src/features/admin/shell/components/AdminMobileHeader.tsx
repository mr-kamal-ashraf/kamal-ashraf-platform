"use client";

import { BrandLogo } from "@/shared/components/BrandLogo";
import { AdminMenuIcon } from "./icons";

interface Props {
  onOpenMenu: () => void;
}

export function AdminMobileHeader({ onOpenMenu }: Props) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-md lg:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <BrandLogo className="h-9 shrink-0" />
        <span className="truncate border-s border-border ps-2.5 text-sm font-extrabold text-foreground">
          لوحة الأدمن
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="فتح القائمة"
        className="flex size-11 items-center justify-center rounded-xl border border-border text-foreground hover:bg-muted"
      >
        <AdminMenuIcon />
      </button>
    </header>
  );
}
