"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { AppearanceProvider, useAppearance } from "./AppearanceProvider";
import { PanelBoundary } from "./components/PanelBoundary";
import { AnnouncementPanel } from "./sections/AnnouncementPanel";
import { ContactPanel } from "./sections/ContactPanel";
import { FaqPanel } from "./sections/FaqPanel";
import { FontsPanel } from "./sections/FontsPanel";
import { HeroPanel } from "./sections/HeroPanel";
import { ImagesPanel } from "./sections/ImagesPanel";
import { ThemePanel } from "./sections/ThemePanel";
import { WelcomePanel } from "./sections/WelcomePanel";
import { WhyUsPanel } from "./sections/WhyUsPanel";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

const TABS = [
  { id: "theme", label: "الألوان", Panel: ThemePanel },
  { id: "fonts", label: "الخطوط", Panel: FontsPanel },
  { id: "images", label: "الصور", Panel: ImagesPanel },
  { id: "hero", label: "الصفحة الرئيسية", Panel: HeroPanel },
  { id: "whyUs", label: "ليه تذاكر معانا", Panel: WhyUsPanel },
  { id: "faq", label: "الأسئلة الشائعة", Panel: FaqPanel },
  { id: "contact", label: "التواصل", Panel: ContactPanel },
  { id: "announcement", label: "شريط الإعلانات", Panel: AnnouncementPanel },
  { id: "welcome", label: "بوب أب التهنئة", Panel: WelcomePanel },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Content() {
  const { loading, error, reload } = useAppearance();
  const [tab, setTab] = useState<TabId>("theme");

  if (loading) return <LoadingScreen variant="page" />;

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-8 text-center sm:px-8">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <p className="mt-3 text-base font-extrabold text-foreground">{error.title}</p>
        {error.message && (
          <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">{error.message}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reload}
            className="min-h-10 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground"
          >
            حاول تاني
          </button>
          {error.needsLogin && (
            <a
              href="/admin/login"
              className="inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-5 text-xs font-bold text-foreground"
            >
              سجّل دخول
            </a>
          )}
        </div>
        {error.technical && (
          <details className="mx-auto mt-5 max-w-lg text-start text-[11px] text-muted-foreground">
            <summary className="cursor-pointer">تفاصيل للمطوّر</summary>
            <code className="mt-1 block break-all" dir="ltr">
              {error.technical}
            </code>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div role="tablist" aria-label="أقسام المظهر والمحتوى" className="inline-flex min-w-full gap-1 rounded-xl border border-border bg-card p-1 shadow-soft">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`appearance-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`appearance-panel-${t.id}`}
              onClick={(e) => {
                setTab(t.id);
                e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
              }}
              className={cn(
                "min-h-9.5 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-xs font-bold transition-colors sm:text-sm",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Every panel stays mounted so switching tabs never drops unsaved edits. */}
      {TABS.map(({ id, Panel }) => (
        <div
          key={id}
          role="tabpanel"
          id={`appearance-panel-${id}`}
          aria-labelledby={`appearance-tab-${id}`}
          hidden={tab !== id}
        >
          <PanelBoundary name={id}>
            <Panel />
          </PanelBoundary>
        </div>
      ))}
    </div>
  );
}

/** Admin "المظهر والمحتوى": palette, images and the website's editable texts. */
export function AppearanceView() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">المظهر والمحتوى</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            غيّر ألوان المنصة وصورها والكلام اللي عليها. كل قسم بيتحفظ لوحده وبيظهر للطلبة في خلال
            ثواني.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground shadow-soft transition-colors hover:border-primary/40"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
          افتح المنصة
        </a>
      </div>

      <AppearanceProvider>
        <Content />
      </AppearanceProvider>
    </div>
  );
}
