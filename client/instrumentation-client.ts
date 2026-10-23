import { navigationStarted } from "@/shared/navigation/navigationProgress";

/**
 * Next runs this the moment a page change starts (a Link click, router.push
 * or router.replace) — before the server has answered — so the loading screen
 * can appear right away. Back/forward ("traverse") restore pages from memory.
 */
export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  if (navigationType !== "traverse") navigationStarted(url);
}
