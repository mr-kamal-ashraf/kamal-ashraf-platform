"use client";

import { SiteHeader } from "@/shared/components/SiteHeader";
import { PageBackdrop } from "@/shared/components/bio";
import { RegisterProvider } from "./RegisterProvider";
import { RegisterBrandSide } from "./sections/RegisterBrandSide";
import { RegisterFormSide } from "./sections/RegisterFormSide";

export function RegisterView() {
  return (
    <RegisterProvider>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="relative flex-1">
          <PageBackdrop className="lg:hidden" />
          <div className="grid lg:grid-cols-2 lg:min-h-[calc(100vh-6rem)]">
            <RegisterBrandSide />
            <RegisterFormSide />
          </div>
        </main>
      </div>
    </RegisterProvider>
  );
}
