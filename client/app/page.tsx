import type { Metadata } from "next";
import { SiteHeader } from "@/shared/components/SiteHeader";
import { SiteFooter } from "@/shared/components/SiteFooter";
import { Hero } from "@/features/home/sections/Hero";
import { Marquee } from "@/features/home/sections/Marquee";
import { WhyUs } from "@/features/home/sections/WhyUs";
import { LessonsCarousel } from "@/features/home/sections/LessonsCarousel";
import { Faq } from "@/features/home/sections/Faq";
import { getSiteSettings } from "@/shared/site-settings/server";
import { JsonLd } from "@/shared/seo/JsonLd";
import { homeGraph } from "@/shared/seo/structured-data";
import { pageOpenGraph, SEO_DESCRIPTION, SEO_TITLE } from "@/shared/seo/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: pageOpenGraph({
    url: "/",
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
  }),
};

export default async function HomePage() {
  const settings = await getSiteSettings();
  return (
    <div className="relative min-h-screen">
      <JsonLd data={homeGraph(settings)} />
      <SiteHeader />
      <main>
        <Hero />
        <Marquee />
        <WhyUs />
        <LessonsCarousel />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}
