import Link from "next/link";
import { BtnNucleus } from "@/shared/ui/Button";

export function LessonNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
      <div className="mb-6 inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-brand">
        <svg
          className="size-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="text-3xl font-extrabold sm:text-4xl">الدرس مش موجود</h1>
      <p className="mt-3 max-w-md text-base text-muted-foreground">
        الدرس اللي بتدور عليه يا اتشال يا الرابط غلط. ارجع لصفحة الدروس واختار
        درس تاني.
      </p>
      <Link
        href="/#lessons"
        className="btn btn-primary btn-lg mt-8"
      >
        <BtnNucleus />
        ارجع للدروس
      </Link>
    </main>
  );
}
