"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LOGIN_REQUIRED_REASON_CONFIG,
  type LoginRequiredReason,
} from "./login-required-config";
import { PopupReasonIcon } from "./popup-icons";
import { BtnNucleus } from "@/shared/ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
  reason?: LoginRequiredReason;
  message?: string;
}

export function LoginRequiredPopup({
  open,
  onClose,
  reason = "guest",
  message,
}: Props) {
  const config = LOGIN_REQUIRED_REASON_CONFIG[reason];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-elegant"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />

            <div className="p-8 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PopupReasonIcon reason={reason} />
              </div>

              <h3 className="mt-5 text-xl font-extrabold text-foreground">
                {config.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {message || config.description}
              </p>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  onClick={onClose}
                  className="btn btn-secondary"
                >
                  إغلاق
                </button>
                <Link
                  href={config.cta.href}
                  className="btn btn-primary"
                >
                  <BtnNucleus />
                  {config.cta.label}
                </Link>
              </div>

              {reason === "guest" && (
                <p className="mt-5 text-xs text-muted-foreground">
                  معندكش حساب؟{" "}
                  <Link
                    href="/register"
                    className="font-bold text-primary hover:underline"
                  >
                    سجّل دلوقتي
                  </Link>
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
