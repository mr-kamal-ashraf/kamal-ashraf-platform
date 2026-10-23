import type { NextConfig } from "next";

const securityHeaders = [
  // Tells browsers not to MIME-sniff. Defends against content-type confusion.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block our pages from being embedded in iframes (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Don't leak full URLs (which may include tokens) in the Referer header.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Tightly scope which device APIs the page can use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Force HTTPS once the site has been visited over TLS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Cross-origin isolation hints — don't expose us to side-channel attacks.
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Logos / hero portraits uploaded from the admin panel are served from
  // Cloudinary; next/image needs the host allow-listed to optimise them.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Third-party files we host ourselves carry their version in the name
      // (e.g. paymob-pixel-1.2.9.js), so browsers can keep them for good.
      {
        source: "/vendor/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
