import Link from "next/link";
import {
  BioIcon,
  CellPattern,
  FloatingSpecimen,
} from "@/shared/components/bio";
import { BtnNucleus } from "@/shared/ui/Button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <CellPattern className="text-primary/6" />
      <FloatingSpecimen
        name="crystal"
        className="left-[8%] top-[14%] size-24 text-highlight/12"
      />
      <FloatingSpecimen
        name="leaf"
        className="bottom-[12%] right-[8%] size-28 text-primary/10"
        delay={5}
      />

      <div className="relative max-w-md text-center">
        {/* a fossil where the page used to be */}
        <div className="relative mx-auto flex size-36 items-center justify-center">
          <span className="absolute inset-0 animate-ripple rounded-full border-2 border-primary/25" />
          <span
            className="absolute inset-0 animate-ripple rounded-full border-2 border-highlight/25"
            style={{ animationDelay: "-1.8s" }}
          />
          <div className="flex size-28 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground shadow-brand">
            <BioIcon name="ammonite" className="size-20" strokeWidth={2.4} />
          </div>
        </div>

        <h1 className="mt-6 text-7xl font-black text-gradient-brand">٤٠٤</h1>
        <h2 className="mt-3 text-xl font-extrabold text-foreground">
          الصفحة دي شكلها انقرضت 🦕
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          الصفحة اللي بتدوّر عليها مش موجودة أو اتنقلت — بقت حفرية في طبقات
          الموقع.
        </p>
        <div className="mt-7">
          <Link
            href="/"
            className="btn btn-primary btn-lg"
          >
            <BtnNucleus />
            ارجع للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
