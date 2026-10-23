"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { AdminSidebar } from "./AdminSidebar";

interface Props {
  open: boolean;
  onClose: () => void;
  adminName?: string;
  onLogout: () => void;
}

export function AdminSidebarDrawer({
  open,
  onClose,
  adminName,
  onLogout,
}: Props) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="admin-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm lg:hidden"
            aria-hidden="true"
          />
          <motion.aside
            key="admin-drawer-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-label="قائمة لوحة الأدمن"
            aria-modal="true"
            className="fixed right-0 top-0 z-50 flex h-screen w-[85%] max-w-sm flex-col border-l border-border bg-card shadow-elegant lg:hidden"
          >
            <AdminSidebar
              adminName={adminName}
              onLogout={onLogout}
              onNavigate={onClose}
              onClose={onClose}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
