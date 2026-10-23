import { BioIcon, type BioIconName } from "@/shared/components/bio";

const ICONS: BioIconName[] = ["dna", "leaf", "crystal", "cell"];

/** Small specimen between marquee phrases — cycles DNA · leaf · crystal · cell. */
export function MarqueeDivider({ index = 0 }: { index?: number }) {
  return (
    <BioIcon
      name={ICONS[index % ICONS.length]}
      className="size-5 shrink-0 text-highlight"
      strokeWidth={3.2}
    />
  );
}
