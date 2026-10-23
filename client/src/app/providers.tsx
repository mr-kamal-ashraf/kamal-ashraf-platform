"use client";

import { Suspense, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/AuthContext";
import { FloatingAIChat } from "@/features/ai-chat/FloatingAIChat";
import { AnnouncementBar } from "@/shared/components/AnnouncementBar";
import { applyThemeMode, themeStorageKey } from "@/shared/lib/themeMode";
import { NavigationLoader } from "@/shared/navigation/NavigationLoader";
import { useSiteSettings } from "@/shared/site-settings";

/**
 * Popups + floating widgets that should render across the whole student site
 * but never inside the admin panel (which has its own layout + AI chat page).
 *
 * FloatingAIChat has its own internal gate (logged-in), so if it decides to
 * hide itself the button simply doesn't appear. This wrapper just prevents it
 * from rendering on admin routes where it would collide with the admin chat page.
 */
function StudentOnlyOverlays() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/admin")) return null;
  return (
    <>
      <FloatingAIChat />
    </>
  );
}

/** The teacher's announcement bar sits above every student page (not the admin panel). */
function StudentAnnouncement() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/admin")) return null;
  return <AnnouncementBar />;
}

/**
 * Moving between the site and the admin panel without a reload: each side
 * takes its own light/dark mode (they are kept apart), before the page paints.
 */
function ThemeSideSync() {
  const side = themeStorageKey(usePathname() ?? "");
  const { theme } = useSiteSettings();
  const shown = useRef(side);
  useLayoutEffect(() => {
    if (shown.current === side) return;
    shown.current = side;
    applyThemeMode(theme.defaultMode, theme.allowModeToggle);
  }, [side, theme.defaultMode, theme.allowModeToggle]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeSideSync />
      <StudentAnnouncement />
      {children}
      <StudentOnlyOverlays />
      {/* useSearchParams inside: its own boundary keeps pages static. */}
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>
      <Toaster richColors position="top-center" closeButton />
    </AuthProvider>
  );
}
