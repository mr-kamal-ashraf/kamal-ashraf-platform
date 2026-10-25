"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { progressApi } from "@/api";
import { AuthProvider, useAuth } from "@/features/auth/AuthContext";
import { AnnouncementBar } from "@/shared/components/AnnouncementBar";
import { applyThemeMode, themeStorageKey } from "@/shared/lib/themeMode";
import { NavigationLoader } from "@/shared/navigation/NavigationLoader";
import { useSiteSettings } from "@/shared/site-settings";

/** Downloaded only for students who can use it, after the page has shown. */
const FloatingAIChat = dynamic(
  () => import("@/features/ai-chat/FloatingAIChat").then((m) => m.FloatingAIChat),
  { ssr: false },
);

/**
 * Popups + floating widgets that should render across the whole student site
 * but never inside the admin panel (which has its own layout + AI chat page).
 *
 * The AI chat is for students with a course; visitors and everyone else never
 * download it. FloatingAIChat still has its own gate (pages it hides on). This
 * wrapper also keeps it off admin routes, where it would collide with the
 * admin chat page.
 */
function StudentOnlyOverlays() {
  const pathname = usePathname() ?? "";
  const canChat = useAuth().user?.hasOwnedCourse;
  if (pathname.startsWith("/admin") || !canChat) return null;
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

/**
 * Lesson progress a phone never got to send (it closed the browser in the
 * background) goes out once, the next time the student opens the site.
 * Nothing is sent when there's nothing left over.
 */
function SendLeftoverProgress() {
  const userId = useAuth().user?._id;
  useEffect(() => {
    if (userId) void progressApi.sendLeftovers(userId);
  }, [userId]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeSideSync />
      <SendLeftoverProgress />
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
