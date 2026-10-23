import type { Metadata } from "next";
import "@/styles.css";
import { Providers } from "@/app/providers";
import { SITE } from "@/shared/i18n/site";
import { SiteSettingsProvider, type ThemeMode } from "@/shared/site-settings";
import { getSiteSettings } from "@/shared/site-settings/server";
import {
  ADMIN_FONT,
  fontFamily,
  fontStyleVars,
  type FontKey,
} from "@/config/fonts";
import { FONT_FACE_CSS, FONT_PRELOADS } from "@/config/fonts.generated";
import { SITE_URL } from "@/config/env";
import {
  OG_IMAGE,
  SEO_DESCRIPTION,
  SEO_KEYWORDS,
  SEO_TITLE,
} from "@/shared/seo/seo";

/**
 * @font-face rules for this render: the active font only, plus the admin
 * panel's font when it differs. The other fonts' rules are never sent, so
 * visitors pay for one font whatever the list holds.
 */
function platformFontCss(active: FontKey): string {
  return active === ADMIN_FONT
    ? FONT_FACE_CSS[active]
    : FONT_FACE_CSS[active] + FONT_FACE_CSS[ADMIN_FONT];
}

/**
 * Site-wide search & share defaults. Pages add their own title (through the
 * template), description, canonical URL and share card. No canonical / og:url
 * here on purpose — inherited, they would point every page at the home page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: SEO_TITLE,
      template: `%s | ${SITE.teacherName}`,
    },
    description: SEO_DESCRIPTION,
    keywords: SEO_KEYWORDS,
    applicationName: SITE.brand,
    authors: [{ name: SITE.teacherName, url: SITE_URL }],
    creator: SITE.teacherName,
    publisher: SITE.brand,
    category: "education",
    formatDetection: { telephone: false, email: false, address: false },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    icons: {
      icon: settings.favicon,
      shortcut: settings.favicon,
      apple: settings.favicon,
    },
    openGraph: {
      type: "website",
      locale: "ar_EG",
      siteName: SITE.brand,
      title: SEO_TITLE,
      description: SEO_DESCRIPTION,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: SEO_TITLE,
      description: SEO_DESCRIPTION,
      images: [OG_IMAGE.url],
    },
    ...(googleVerification
      ? { verification: { google: googleVerification } }
      : {}),
  };
}

/**
 * Applies the light/dark mode before first paint (no flash). Visitors keep
 * their own choice when the teacher allows the toggle; otherwise everyone gets
 * the teacher's default ("system" follows the device setting).
 */
function themeInitScript(defaultMode: ThemeMode, allowToggle: boolean) {
  return `(function(){try{var allow=${allowToggle ? "true" : "false"};var def=${JSON.stringify(defaultMode)};var saved=allow?localStorage.getItem('theme'):null;var t=(saved==='light'||saved==='dark')?saved:(def==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):def);if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  const activeFont = settings.typography.font;
  return (
    <html
      lang="ar"
      dir="rtl"
      data-palette={settings.theme.palette}
      suppressHydrationWarning
      // The teacher's chosen font + its size correction (admin → المظهر
      // والمحتوى → الخطوط), and the admin panel's own font; styles.css
      // builds the font and text sizes from them.
      style={
        {
          ...fontStyleVars(activeFont),
          "--font-admin": fontFamily(ADMIN_FONT),
        } as React.CSSProperties
      }
    >
      <head>
        {/* Start the active font's Arabic file with the HTML, not after the CSS. */}
        {FONT_PRELOADS[activeFont].map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
        {/* A React 19 style resource (href + precedence): React hoists it and
            claims it by its href during hydration instead of by position, so
            a <style> that a browser extension injects into <head> (Opera GX
            does) can no longer be mistaken for it and trigger a mismatch. */}
        <style href={`platform-fonts-${activeFont}`} precedence="default">
          {platformFontCss(activeFont)}
        </style>
        <script
          dangerouslySetInnerHTML={{
            __html: themeInitScript(
              settings.theme.defaultMode,
              settings.theme.allowModeToggle,
            ),
          }}
        />
      </head>
      <body>
        <SiteSettingsProvider value={settings}>
          <Providers>{children}</Providers>
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
