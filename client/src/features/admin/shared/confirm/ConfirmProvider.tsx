"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface ConfirmOptions {
  /** Bold heading. Optional — omit for a message-only dialog. */
  title?: string;
  /** The question / body text. */
  message: string;
  /** Confirm button label (default: "تأكيد"). */
  confirmLabel?: string;
  /** Cancel button label (default: "إلغاء"). */
  cancelLabel?: string;
  /** "danger" paints the confirm button + accent red — use it for deletes. */
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

function QuestionIcon() {
  return (
    <svg
      className="size-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="size-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

/**
 * Provides an imperative, promise-based confirmation dialog for the admin
 * panel — a styled replacement for the native window.confirm(). Mount it once
 * high in the admin tree; any descendant calls `const confirm = useConfirm()`
 * then `if (await confirm({ ... }))` inside an async handler.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const close = useCallback((result: boolean) => {
    setPending((prev) => {
      prev?.resolve(result);
      return null;
    });
  }, []);

  // Focus the confirm button and wire Escape-to-cancel while a dialog is open.
  useEffect(() => {
    if (!pending) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const danger = pending?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(false)}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ scale: 0.95, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className={`card-strata relative w-full max-w-md overflow-hidden rounded-3xl${
                danger ? " card-strata-danger" : ""
              }`}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                      danger
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {danger ? <TrashIcon /> : <QuestionIcon />}
                  </div>
                  <div className="flex-1 pt-1">
                    {pending.title && (
                      <h3 className="text-lg font-extrabold text-foreground">
                        {pending.title}
                      </h3>
                    )}
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {pending.message}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="rounded-xl border-2 border-border bg-background px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
                  >
                    {pending.cancelLabel ?? "إلغاء"}
                  </button>
                  <button
                    ref={confirmBtnRef}
                    type="button"
                    onClick={() => close(true)}
                    className={`rounded-xl px-5 py-2.5 text-sm font-bold shadow-brand transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card ${
                      danger
                        ? "bg-destructive text-white focus:ring-destructive/50"
                        : "bg-gradient-brand text-primary-foreground focus:ring-primary/50"
                    }`}
                  >
                    {pending.confirmLabel ?? "تأكيد"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
