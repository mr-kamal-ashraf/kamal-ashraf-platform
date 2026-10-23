"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/AuthContext";
import { FloatingAIChat } from "@/features/ai-chat/FloatingAIChat";
import { AnnouncementBar } from "@/shared/components/AnnouncementBar";
import { NavigationLoader } from "@/shared/navigation/NavigationLoader";

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

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
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
