import { SITE_URL, resolveAssetUrl } from "@/config/env";
import type { CourseDetailResponse } from "@/api/types";
import { SITE } from "@/shared/i18n/site";
import { STAGE_LONG_LABELS } from "@/shared/lib/stage";
import type { SiteSettings } from "@/shared/site-settings";
import { OG_IMAGE, absoluteImage, absoluteUrl } from "./seo";

/*
 * schema.org structured data (JSON-LD) — tells Google what the site is: an
 * educational organisation, its teacher, its courses with their prices, the
 * FAQ and the breadcrumb trail. Built from the same settings and catalogue the
 * pages render, so it never disagrees with what visitors see.
 */

const ORG_ID = `${SITE_URL}/#organization`;
const TEACHER_ID = `${SITE_URL}/#teacher`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/** Home page: organisation + teacher + website (+ FAQ when there are questions). */
export function homeGraph(settings: SiteSettings) {
  const c = settings.contact;
  const sameAs = [
    c.facebook,
    c.instagram,
    c.youtube,
    c.tiktok,
    c.telegram,
  ].filter((url) => /^https?:\/\//i.test(url));
  const faq = settings.faq.items.filter(
    (item) => item.q.trim() && item.a.trim(),
  );

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": ORG_ID,
        name: SITE.brand,
        alternateName: SITE.teacherName,
        url: SITE_URL,
        logo: absoluteImage(settings.assets.logo),
        image: absoluteUrl(OG_IMAGE.url),
        description: SITE.description,
        areaServed: { "@type": "Country", name: "Egypt" },
        founder: { "@id": TEACHER_ID },
        ...(sameAs.length ? { sameAs } : {}),
        ...(c.phone
          ? {
              contactPoint: {
                "@type": "ContactPoint",
                telephone: c.phone,
                contactType: "customer support",
                areaServed: "EG",
                availableLanguage: ["ar"],
              },
            }
          : {}),
      },
      {
        "@type": "Person",
        "@id": TEACHER_ID,
        name: SITE.teacherName,
        jobTitle: "مدرس أحياء وجيولوجيا",
        image: absoluteImage(settings.assets.hero),
        worksFor: { "@id": ORG_ID },
        knowsAbout: [
          "الأحياء",
          "الجيولوجيا",
          ...SITE.topics.map((t) => t.label),
        ],
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_URL,
        name: SITE.brand,
        inLanguage: "ar",
        publisher: { "@id": ORG_ID },
      },
      ...(faq.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faq.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ]
        : []),
    ],
  };
}

/** A course page: the course (price, level, teacher) + its breadcrumb. */
export function courseGraph(data: CourseDetailResponse) {
  const { course } = data;
  const url = absoluteUrl(`/courses/${course.slug}`);
  const image = resolveAssetUrl(course.thumbnail) ?? absoluteUrl(OG_IMAGE.url);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Course",
        "@id": `${url}#course`,
        name: course.title,
        description: course.description || course.longDescription,
        url,
        image,
        inLanguage: "ar",
        educationalLevel: STAGE_LONG_LABELS[course.stage],
        provider: {
          "@type": "EducationalOrganization",
          "@id": ORG_ID,
          name: SITE.brand,
          url: SITE_URL,
        },
        offers: {
          "@type": "Offer",
          price: course.price,
          priceCurrency: "EGP",
          category: course.price > 0 ? "Paid" : "Free",
          availability: "https://schema.org/InStock",
          url,
        },
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "Online",
          courseWorkload: `PT${Math.max(
            1,
            Math.round(
              data.lessons.reduce((m, l) => m + (l.durationMinutes || 0), 0) /
                60,
            ),
          )}H`,
          instructor: {
            "@type": "Person",
            "@id": TEACHER_ID,
            name: SITE.teacherName,
          },
        },
      },
      breadcrumb([
        { name: "الرئيسية", path: "/" },
        { name: "الكورسات", path: "/courses" },
        { name: course.title, path: `/courses/${course.slug}` },
      ]),
    ],
  };
}

function breadcrumb(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
