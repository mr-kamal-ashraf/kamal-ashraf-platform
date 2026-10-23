"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { adminAuthApi, isApiError } from "@/api";
import { useAdminAuth } from "@/features/admin/auth/AdminAuthContext";
import { toastAdminError } from "@/features/admin/shared/errors";
import { cn } from "@/shared/lib/cn";

const INPUT =
  "min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const RULES = [
  { label: "٨ حروف على الأقل", test: (v: string) => v.length >= 8 },
  { label: "حرف إنجليزي واحد على الأقل", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "رقم واحد على الأقل", test: (v: string) => /\d/.test(v) },
];

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  error?: string | null;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-foreground">{label}</span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          dir="ltr"
          aria-invalid={error ? true : undefined}
          className={cn(INPUT, "pe-11", error && "border-destructive focus:border-destructive focus:ring-destructive")}
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
          className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {show ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M1 1l22 22" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      {error && <span className="mt-1 block text-[11px] font-bold text-destructive">{error}</span>}
    </label>
  );
}

/** Admin "حسابي": account info + change password (signs out other devices). */
export function AccountView() {
  const { admin } = useAdminAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);

  const rulesOk = RULES.every((r) => r.test(next));
  const matches = next.length > 0 && next === confirm;
  const differs = next.length > 0 && next !== current;
  const canSubmit = current.length > 0 && rulesOk && matches && differs && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await adminAuthApi.changePassword({ currentPassword: current, newPassword: next });
      toast.success("تم تغيير كلمة السر، وتم تسجيل الخروج من الأجهزة التانية");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      if (isApiError(err) && err.code === "WRONG_CURRENT_PASSWORD") setCurrentError(err.message);
      toastAdminError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">حسابي</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          بيانات حساب الأدمن وتغيير كلمة السر.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">الاسم</dt>
            <dd className="mt-1 text-sm font-bold text-foreground">{admin?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">الإيميل</dt>
            <dd className="mt-1 truncate text-sm font-bold text-foreground" dir="ltr">
              {admin?.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">آخر دخول</dt>
            <dd className="mt-1 text-sm font-bold text-foreground">
              {admin?.lastLoginAt
                ? new Date(admin.lastLoginAt).toLocaleString("ar-EG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-base font-extrabold text-foreground">تغيير كلمة السر</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          بعد التغيير هيتعمل تسجيل خروج من أي جهاز تاني داخل على لوحة التحكم، والجهاز ده هيفضل
          شغال عادي.
        </p>

        <div className="mt-5 grid max-w-xl gap-4">
          <PasswordField
            label="كلمة السر الحالية"
            value={current}
            onChange={(v) => {
              setCurrent(v);
              setCurrentError(null);
            }}
            autoComplete="current-password"
            error={currentError}
          />
          <PasswordField label="كلمة السر الجديدة" value={next} onChange={setNext} autoComplete="new-password" />
          <PasswordField label="تأكيد كلمة السر الجديدة" value={confirm} onChange={setConfirm} autoComplete="new-password" />

          <ul className="space-y-1.5 text-xs">
            {[
              ...RULES.map((r) => ({ label: r.label, ok: r.test(next) })),
              { label: "التأكيد مطابق لكلمة السر الجديدة", ok: matches },
              { label: "مختلفة عن كلمة السر الحالية", ok: differs },
            ].map((r) => (
              <li
                key={r.label}
                className={cn(
                  "flex items-center gap-2",
                  r.ok ? "text-emerald-600" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border",
                    r.ok ? "border-emerald-600 bg-emerald-600 text-white" : "border-border",
                  )}
                >
                  {r.ok && (
                    <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                {r.label}
              </li>
            ))}
          </ul>

          <div>
            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-11 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {busy ? "جارٍ الحفظ..." : "تغيير كلمة السر"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
