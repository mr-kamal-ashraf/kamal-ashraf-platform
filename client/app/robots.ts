import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/env";

/**
 * /robots.txt — the public pages are open to search engines; the admin panel,
 * the logged-in player, profile, checkout, payment results and password reset
 * are not.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/player/",
          "/profile",
          "/payment/",
          "/checkout/",
          "/forgot-password",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
