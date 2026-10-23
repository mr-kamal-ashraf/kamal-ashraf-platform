"use client";

import { useAuth } from "@/features/auth/AuthContext";
import { BioIcon, CellPattern } from "@/shared/components/bio";
import { StageBadge } from "@/shared/ui/StageBadge";

export function ProfileHeader() {
  const { user } = useAuth();
  if (!user) return null;

  const initial = user.firstName.trim()[0] ?? "؟";

  return (
    <header className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-elegant">
      {/* cover band */}
      <div className="relative h-28 overflow-hidden bg-gradient-brand dark:bg-brand-deep sm:h-32">
        <CellPattern className="text-white/15" fade={false} scale={0.7} />
        <BioIcon
          name="dna"
          className="absolute -left-4 -top-6 size-40 rotate-12 text-white/15"
        />
        <BioIcon
          name="leaf"
          className="absolute -bottom-6 right-[12%] size-24 text-white/10"
        />
      </div>

      <div className="relative px-6 pb-7 sm:px-8">
        {/* Only the avatar rides up onto the cover; the name starts below it
            (sm:pt-14 clears the -mt-12), always on the card's own colour. */}
        <div className="-mt-12 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-start">
          <div className="flex size-24 shrink-0 items-center justify-center rounded-3xl border-4 border-card bg-gradient-highlight text-4xl font-black text-primary-foreground shadow-highlight">
            {initial}
          </div>
          <div className="min-w-0 flex-1 sm:pt-14">
            <h1 className="truncate text-2xl font-extrabold text-foreground sm:text-3xl">
              {user.firstName} {user.secondName} {user.thirdName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
              <StageBadge stage={user.stage} />
              <span>
                انضممت في {new Date(user.createdAt).toLocaleDateString("ar-EG")}
              </span>
            </div>
          </div>
        </div>

        <dl className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.05-.24 11.36 11.36 0 0 0 3.58.57 1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.58 1 1 0 0 1-.24 1.05l-2.2 2.2Z" />
              </svg>
            </span>
            <div>
              <dt className="text-xs text-muted-foreground">رقم هاتفك</dt>
              <dd className="mt-0.5 font-mono font-bold" dir="ltr">
                {user.studentPhone}
              </dd>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-highlight/12 text-highlight">
              <BioIcon name="users" className="size-5" />
            </span>
            <div>
              <dt className="text-xs text-muted-foreground">رقم ولي الأمر</dt>
              <dd className="mt-0.5 font-mono font-bold" dir="ltr">
                {user.parentPhone}
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </header>
  );
}
