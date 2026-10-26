import { randomBytes } from "crypto";

/*
 * Page links (slugs) made from a title, so the teacher never has to invent an
 * English link. Arabic is written in Latin letters the way it's said in Egypt
 * ("الخلية والوراثة" → "alkhlya-walwrasa"); anything else becomes a dash.
 */

const LATIN: Record<string, string> = {
  ا: "a", أ: "a", إ: "e", آ: "a", ء: "", ؤ: "o", ئ: "e", ى: "a", ة: "a",
  ب: "b", ت: "t", ث: "s", ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r",
  ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh",
  ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w", ي: "y",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/** Harakat and the tatweel: dropped, they're not letters. */
const MARKS = /[ً-ْٰـ]/g;
const MAX_LENGTH = 60;

/** "مراجعة الوراثة ٢" → "mragaa-alwrasa-2"; `fallback` when nothing is left. */
export function slugFromTitle(title: string, fallback: string): string {
  let out = "";
  for (const ch of title.normalize("NFKC").toLowerCase().replace(MARKS, "")) {
    if (/[a-z0-9]/.test(ch)) out += ch;
    else out += LATIN[ch] ?? "-";
  }
  out = out.replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (out.length > MAX_LENGTH) {
    // Cut at a word boundary when there is one.
    const cut = out.slice(0, MAX_LENGTH);
    out = (cut.includes("-") ? cut.slice(0, cut.lastIndexOf("-")) : cut).replace(/-$/, "");
  }
  return out || fallback;
}

/** Matches `base` and its numbered copies (`base-2`, `base-3`, …). */
export function slugFamily(base: string): RegExp {
  // A slug is [a-z0-9-] only, so it needs no escaping.
  return new RegExp(`^${base}(-\\d+)?$`);
}

/** The first link in `base`'s family that `taken` doesn't hold. */
export function firstFreeSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n <= taken.size + 1; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** Two saves picked the same free link at once: one more try, with a random tail. */
export function withRandomTail(slug: string): string {
  return `${slug}-${randomBytes(3).toString("hex")}`;
}

/** Mongo's duplicate-key error on the `slug` index. */
export function isDuplicateSlugError(err: unknown): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> } | null;
  return e?.code === 11000 && !!e.keyPattern && "slug" in e.keyPattern;
}
