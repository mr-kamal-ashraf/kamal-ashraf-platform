import type { User } from "@/api/types";

export function StudentStatusBadge({ user }: { user: User }) {
  if (user.isSuspended) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-600">
        معلق
      </span>
    );
  }
  if (!user.isActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600">
        بانتظار التفعيل
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
      مفعل
    </span>
  );
}
