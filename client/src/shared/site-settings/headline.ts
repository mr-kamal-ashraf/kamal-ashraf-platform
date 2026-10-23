import type { HeroSettings } from "./types";

/** How many coloured words / phrases the headline can have. */
export const MAX_HEADLINE_HIGHLIGHTS = 5;

export interface HeadlinePart {
  text: string;
  /** Rendered in the brand colour. */
  highlight: boolean;
}

export interface HeroHeadline {
  line1: HeadlinePart[];
  line2: HeadlinePart[];
  /** For each of hero.highlights: is it written in line 1 or 2? (If not, nothing is coloured for it.) */
  found: boolean[];
}

/** Arabic letter variants teachers type interchangeably (أ/ا, ى/ي, ة/ه).
 *  One character for one, so indices in the folded text match the original. */
function fold(text: string): string {
  return text
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

/** The same phrase, ignoring those letter variants and spaces at the ends. */
export function samePhrase(a: string, b: string): boolean {
  return fold(a.trim()) === fold(b.trim());
}

/** `text` cut into plain / coloured parts, `lit` saying which characters are coloured. */
function toParts(text: string, lit: boolean[]): HeadlinePart[] {
  const parts: HeadlinePart[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.highlight === lit[i]) last.text += text[i];
    else parts.push({ text: text[i], highlight: lit[i] });
  }
  return parts;
}

/**
 * The two headline lines with الكلمات الملونة coloured where each is written —
 * line 1 first, else line 2 (its first place there). Text is never added or
 * repeated: a phrase found in neither line just colours nothing. Shared by the
 * hero, the admin preview and the admin validation, so all three always agree.
 */
export function heroHeadline(hero: HeroSettings): HeroHeadline {
  const lines = [hero.line1, hero.line2];
  const folded = lines.map(fold);
  const lit = lines.map((line) => new Array<boolean>(line.length).fill(false));
  const found = hero.highlights.map((highlight) => {
    const phrase = fold(highlight.trim());
    if (!phrase) return false;
    for (let n = 0; n < lines.length; n++) {
      const at = folded[n].indexOf(phrase);
      if (at >= 0) {
        lit[n].fill(true, at, at + phrase.length);
        return true;
      }
    }
    return false;
  });
  return {
    line1: toParts(lines[0], lit[0]),
    line2: toParts(lines[1], lit[1]),
    found,
  };
}
