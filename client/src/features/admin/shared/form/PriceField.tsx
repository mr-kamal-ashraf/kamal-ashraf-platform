import { cn } from "@/shared/lib/cn";
import { INPUT_CLASS } from "./styles";

/** The price in pounds, with a one-tap "free". Digits only. */
export function PriceField({
  value,
  onChange,
}: {
  value: number;
  onChange: (price: number) => void;
}) {
  const free = value === 0;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="numeric"
            value={free ? "" : String(value)}
            placeholder="مثلاً 150"
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, "");
              onChange(digits === "" ? 0 : Number(digits));
            }}
            className={cn(INPUT_CLASS, "pe-14")}
          />
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-bold text-muted-foreground">
            جنيه
          </span>
        </div>
        <button
          type="button"
          aria-pressed={free}
          onClick={() => onChange(0)}
          className="min-h-[44px] shrink-0 rounded-lg border border-border bg-background px-4 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
        >
          مجاني
        </button>
      </div>
      {free && (
        <p className="text-[11px] font-semibold text-emerald-600">
          الكورس هيبقى مجاني للطلاب.
        </p>
      )}
    </div>
  );
}
