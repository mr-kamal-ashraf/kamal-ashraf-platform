"use client";

import { SiteHeader } from "@/shared/components/SiteHeader";
import { PageBackdrop } from "@/shared/components/bio";
import { ProfileChangePassword } from "./sections/ProfileChangePassword";
import { ProfileHeader } from "./sections/ProfileHeader";
import { ProfileLogout } from "./sections/ProfileLogout";
import { ProfileProvider, useProfile } from "./ProfileProvider";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

function ProfileContent() {
  const { authReady } = useProfile();

  if (!authReady) return <LoadingScreen variant="page" />;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="relative flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <PageBackdrop />
        <div className="mx-auto max-w-3xl space-y-6">
          <ProfileHeader />
          <ProfileChangePassword />
          <ProfileLogout />
        </div>
      </main>
    </div>
  );
}

export function ProfileView() {
  return (
    <ProfileProvider>
      <ProfileContent />
    </ProfileProvider>
  );
}
