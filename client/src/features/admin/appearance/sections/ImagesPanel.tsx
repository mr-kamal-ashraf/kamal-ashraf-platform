"use client";

import { useRef, useState, type CSSProperties } from "react";
import { PALETTES, PALETTE_META, type Palette } from "@/config/theme";
import { cn } from "@/shared/lib/cn";
import type { AssetSlot } from "@/shared/site-settings";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { useAppearance } from "../AppearanceProvider";
import { SectionCard } from "../components/form";

const SLOTS: Array<{ slot: AssetSlot; title: string; hint: string; tall?: boolean }> = [
  { slot: "logo", title: "اللوجو", hint: "PNG بخلفية شفافة، عرضه حوالي ٣ أضعاف طوله." },
  { slot: "logoDark", title: "لوجو الوضع الغامق (اختياري)", hint: "لو مرفعتهوش، اللوجو العادي هو اللي بيظهر في الغامق." },
  { slot: "hero", title: "صورة المستر في الصفحة الرئيسية", hint: "PNG مربعة بخلفية شفافة (حوالي ١٢٠٠×١٢٠٠).", tall: true },
];

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPT = ACCEPTED_TYPES.join(",");
const MAX_BYTES = 5 * 1024 * 1024;

/** Light checkerboard so transparent PNGs read clearly. */
const CHECKER: CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, oklch(0.5 0 0 / 0.08) 25%, transparent 25%), linear-gradient(-45deg, oklch(0.5 0 0 / 0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, oklch(0.5 0 0 / 0.08) 75%), linear-gradient(-45deg, transparent 75%, oklch(0.5 0 0 / 0.08) 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

function ImageCard({
  title,
  hint,
  src,
  custom,
  tall,
  busy,
  onUpload,
  onReset,
  dark,
}: {
  title: string;
  hint: string;
  src: string | undefined;
  custom: boolean;
  tall?: boolean;
  busy: boolean;
  onUpload: (file: File) => void;
  onReset: () => void;
  dark?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();
  const [fileError, setFileError] = useState<string | null>(null);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold text-foreground">{title}</div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
            custom ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {custom ? "صورة مرفوعة" : "الصورة الأصلية"}
        </span>
      </div>
      <div
        className={cn(
          "mt-3 flex items-center justify-center overflow-hidden rounded-lg border border-border",
          tall ? "aspect-square" : "h-28",
          // Fixed backdrops (not the admin theme) so a logo is judged on the
          // background it will actually sit on.
          dark ? "bg-[oklch(0.2_0.01_20)]" : "bg-white",
        )}
        style={dark ? undefined : CHECKER}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary uploads
          <img src={src} alt={title} className={cn("max-h-full max-w-full object-contain", tall ? "p-2" : "p-3")} />
        ) : (
          <span className="text-xs text-muted-foreground">مفيش صورة</span>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      {fileError && <p className="mt-1 text-[11px] font-bold text-destructive">{fileError}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (!ACCEPTED_TYPES.includes(file.type)) {
              setFileError("الصيغة دي مش مدعومة — ارفع صورة PNG أو JPG أو WEBP.");
              return;
            }
            if (file.size > MAX_BYTES) {
              setFileError(`الصورة حجمها ${(file.size / 1024 / 1024).toFixed(1)} ميجا — أقصى حجم ٥ ميجا. صغّرها وجرّب تاني.`);
              return;
            }
            setFileError(null);
            onUpload(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="min-h-9.5 flex-1 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "جارٍ الرفع..." : custom ? "تغيير الصورة" : "رفع صورة"}
        </button>
        {custom && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const ok = await confirm({
                title: "رجوع للصورة الأصلية",
                message: "الصورة المرفوعة هتتشال وهترجع الصورة الأصلية. متأكد؟",
                confirmLabel: "رجّعها",
              });
              if (ok) onReset();
            }}
            className="min-h-9.5 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            رجّع الأصلية
          </button>
        )}
      </div>
    </div>
  );
}

export function ImagesPanel() {
  const { raw, resolved, busy, uploadAsset, clearAsset, uploadFavicon, clearFavicon } = useAppearance();
  const [palette, setPalette] = useState<Palette>(resolved.theme.palette);
  const saved = raw?.assets?.[palette] ?? {};
  const shown = resolved.paletteAssets[palette];

  return (
    <div className="space-y-5">
      <SectionCard
        title="صور المنصة"
        description="كل باليت ليها صورها. ارفع صور جديدة للباليت اللي تختارها، ولو مرفعتش حاجة هتفضل الصور الأصلية."
      >
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPalette(p)}
              aria-pressed={palette === p}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
                palette === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="size-3 rounded-full" style={{ background: PALETTE_META[p].light.primary }} />
              {PALETTE_META[p].label}
              {resolved.theme.palette === p && (
                <span className="rounded-full bg-primary px-1.5 py-px text-[9px] text-primary-foreground">الحالية</span>
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {SLOTS.map(({ slot, title, hint, tall }) => (
            <ImageCard
              key={`${palette}-${slot}`}
              title={title}
              hint={hint}
              tall={tall}
              dark={slot === "logoDark"}
              src={slot === "logoDark" ? shown.logoDark ?? undefined : shown[slot]}
              custom={Boolean(saved[slot])}
              busy={busy}
              onUpload={(file) => uploadAsset(palette, slot, file)}
              onReset={() => clearAsset(palette, slot)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="أيقونة التاب (Favicon)"
        description="الأيقونة الصغيرة اللي بتظهر جنب اسم المنصة في تاب المتصفح. لو مرفعتهاش بيظهر اللوجو."
      >
        <div className="max-w-xs">
          <ImageCard
            title="الأيقونة"
            hint="صورة مربعة PNG (حوالي ٢٥٦×٢٥٦)."
            src={resolved.favicon}
            custom={Boolean(raw?.favicon)}
            busy={busy}
            onUpload={uploadFavicon}
            onReset={clearFavicon}
          />
        </div>
      </SectionCard>
    </div>
  );
}

