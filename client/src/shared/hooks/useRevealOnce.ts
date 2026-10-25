"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True once the element has come into view, and it stays true — for entrances
 * that play the first time only. One IntersectionObserver per element instead
 * of scroll listeners, so nothing runs while the page scrolls.
 *
 * `margin` shrinks/grows the viewport edge the element must cross, e.g. the
 * default "0px 0px -10% 0px" waits until its top is 10% above the bottom.
 */
export function useRevealOnce(
  ref: RefObject<Element | null>,
  margin = "0px 0px -10% 0px",
) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, shown]);

  return shown;
}
