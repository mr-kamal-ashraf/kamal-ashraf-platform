"use client";

import { AdminLoginProvider, useAdminLogin } from "./AdminLoginProvider";
import { AdminLoginCard } from "./sections/AdminLoginCard";

function AdminLoginContent() {
  const { checking } = useAdminLogin();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جاري التحقق...
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 px-6">
      <div className="absolute inset-0 -z-10 opacity-40 [background-image:radial-gradient(circle_at_top_right,theme(colors.primary/20),transparent_60%),radial-gradient(circle_at_bottom_left,theme(colors.brand-soft/40),transparent_60%)]" />
      <AdminLoginCard />
    </main>
  );
}

export function AdminLoginView() {
  return (
    <AdminLoginProvider>
      <AdminLoginContent />
    </AdminLoginProvider>
  );
}
