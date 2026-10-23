"use client";

import { SiteHeader } from "@/shared/components/SiteHeader";
import { PageBackdrop } from "@/shared/components/bio";
import { LoginProvider } from "./LoginProvider";
import { LoginBrandSide } from "./sections/LoginBrandSide";
import { LoginFormSide } from "./sections/LoginFormSide";

export function LoginView() {
  return (
    <LoginProvider>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="relative flex-1">
          <PageBackdrop className="lg:hidden" />
          <div className="grid lg:grid-cols-2 lg:min-h-[calc(100vh-6rem)]">
            <LoginBrandSide />
            <LoginFormSide />
          </div>
        </main>
      </div>
    </LoginProvider>
  );
}
