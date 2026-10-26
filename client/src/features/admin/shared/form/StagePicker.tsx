import type { Stage } from "@/api/types";
import { STAGE_LIST } from "@/shared/lib/stage";

/** The three stages side by side — one tap, all choices in view. */
export function StagePicker({
  value,
  onChange,
  name = "stage",
}: {
  value: Stage;
  onChange: (stage: Stage) => void;
  name?: string;
}) {
  return (
    <div role="radiogroup" aria-label="المرحلة" className="grid grid-cols-3 gap-2">
      {STAGE_LIST.map((stage) => (
        <label
          key={stage.key}
          className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border border-border bg-background px-2 py-2 text-center text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary sm:text-sm"
        >
          <input
            type="radio"
            name={name}
            value={stage.key}
            checked={value === stage.key}
            onChange={() => onChange(stage.key)}
            className="sr-only"
          />
          {stage.label}
        </label>
      ))}
    </div>
  );
}
