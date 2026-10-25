import type { CSSProperties } from "react";

/**
 * Inline settings for a `.rise-in` entrance (styles.css): an element fades in
 * from an offset as soon as the page is painted. Plain CSS, so the top of a
 * page shows straight away instead of waiting for its JavaScript — on a slow
 * phone that was seconds.
 *
 *   <h1 className="rise-in" style={riseIn({ delay: 0.2 })}>…</h1>
 */
export function riseIn({
  x = 0,
  y = 20,
  scale = 1,
  delay = 0,
  duration = 0.7,
}: {
  x?: number;
  y?: number;
  scale?: number;
  delay?: number;
  duration?: number;
} = {}): CSSProperties {
  return {
    "--rise-x": `${x}px`,
    "--rise-y": `${y}px`,
    "--rise-scale": scale,
    "--rise-delay": `${delay}s`,
    "--rise-duration": `${duration}s`,
  } as CSSProperties;
}
