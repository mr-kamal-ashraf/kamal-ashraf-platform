"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { getNavigationTarget, subscribe, urlCommitted } from "./navigationProgress";

/**
 * The loading screen for page changes, from the click until the new page is
 * ready (see navigationProgress.ts) — the site and the admin panel alike.
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const target = useSyncExternalStore(subscribe, getNavigationTarget, () => null);

  useEffect(() => {
    urlCommitted();
  }, [pathname, search]);

  if (target === null) return null;
  return <LoadingScreen variant="page" delayed holdsPageChange={false} />;
}
