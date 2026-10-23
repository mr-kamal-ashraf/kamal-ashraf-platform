"use client";

import Image from "next/image";
import { SITE } from "@/shared/i18n/site";
import { cn } from "@/shared/lib/cn";
import { useSiteSettings } from "@/shared/site-settings";

// Intrinsic size of the shipped logo files (3:1). Only the aspect ratio is
// used for layout before the image loads: the rendered height comes from
// `className`, the width follows the real image, and Next serves a resized copy.
const LOGO_WIDTH = 2172;
const LOGO_HEIGHT = 724;

/**
 * The active palette's logo (as chosen/uploaded from the admin panel), in its
 * own colors in both light and dark mode. If the palette has a dark-mode
 * logo, dark mode shows that instead.
 */
export function BrandLogo({ className }: { className?: string }) {
  const { logo, logoDark } = useSiteSettings().assets;
  const alt = SITE.brandShort;
  const common = {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    sizes: "200px",
    priority: true,
  };

  if (logoDark) {
    return (
      <>
        <Image src={logo} alt={alt} {...common} className={cn("w-auto dark:hidden", className)} />
        <Image
          src={logoDark}
          alt={alt}
          {...common}
          className={cn("hidden w-auto dark:block", className)}
        />
      </>
    );
  }

  return <Image src={logo} alt={alt} {...common} className={cn("w-auto", className)} />;
}
