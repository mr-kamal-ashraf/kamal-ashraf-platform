"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SITE } from "@/shared/i18n/site";
import { BrandLogo } from "../BrandLogo";
import { DnaStrand, MiniCell } from "../bio";
import { useSiteSettings } from "@/shared/site-settings";
import { PaymentMethods } from "./PaymentMethods";
import {
  IconFacebook,
  IconInstagram,
  IconMail,
  IconPhone,
  IconTelegram,
  IconTiktok,
  IconWhatsapp,
  IconYoutube,
} from "./socialIcons";

const LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/courses", label: "الكورسات" },
  { href: "/#why", label: "ليه تختارنا" },
  { href: "/login", label: "تسجيل الدخول" },
  { href: "/register", label: "إنشاء حساب" },
  { href: "/terms", label: "الشروط والأحكام" },
];

function ContactRow({
  href,
  icon,
  label,
  value,
  external,
  ltr,
  stroke,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value: string;
  external?: boolean;
  ltr?: boolean;
  stroke?: boolean;
}) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="group flex items-center gap-3 rounded-xl py-1.5 transition-colors"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill={stroke ? "none" : "currentColor"}
            stroke={stroke ? "currentColor" : "none"}
            strokeWidth={stroke ? 2 : undefined}
          >
            {icon}
          </svg>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[11px] text-muted-foreground">{label}</span>
          <span
            className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary"
            dir={ltr ? "ltr" : undefined}
          >
            {value}
          </span>
        </span>
      </a>
    </li>
  );
}

export function SiteFooter() {
  const { contact } = useSiteSettings();

  // Social buttons: only the links the teacher filled in (admin → المظهر والمحتوى).
  // `stroke` icons are outline glyphs; the rest are solid.
  const socials = [
    {
      href: contact.whatsappLink,
      icon: IconWhatsapp,
      label: "واتساب",
      stroke: false,
    },
    {
      href: contact.facebook,
      icon: IconFacebook,
      label: "فيسبوك",
      stroke: false,
    },
    {
      href: contact.instagram,
      icon: IconInstagram,
      label: "إنستجرام",
      stroke: true,
    },
    { href: contact.youtube, icon: IconYoutube, label: "يوتيوب", stroke: true },
    { href: contact.tiktok, icon: IconTiktok, label: "تيك توك", stroke: false },
    {
      href: contact.telegram,
      icon: IconTelegram,
      label: "تليجرام",
      stroke: false,
    },
    { href: contact.telLink, icon: IconPhone, label: "اتصال", stroke: false },
  ].filter((s) => s.href);

  return (
    <footer id="contact" className="mt-24 px-4 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-4xl border border-border bg-card shadow-soft">
        {/* a quiet DNA hairline as the footer's signature edge */}
        <DnaStrand orientation="horizontal" className="h-5 w-full opacity-70" />

        <div className="grid gap-10 px-6 pb-10 pt-6 sm:px-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <Link
              href="/"
              aria-label={SITE.brandShort}
              className="inline-flex items-center"
            >
              <BrandLogo className="h-16" />
            </Link>
            <p className="mt-4 max-w-md text-sm leading-loose text-muted-foreground">
              منصة تعليمية متخصصة في {SITE.subject} لطلبة الإعدادية والثانوية مع{" "}
              {SITE.teacherName}، بأسلوب حديث بالرسم والتجربة يخليك تفهم مش تحفظ
              وتتفوق بثقة.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    s.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className="flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill={s.stroke ? "none" : "currentColor"}
                    stroke={s.stroke ? "currentColor" : "none"}
                    strokeWidth={s.stroke ? 2 : undefined}
                  >
                    {s.icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <nav className="lg:col-span-3" aria-label="روابط سريعة">
            <h4 className="text-sm font-extrabold text-foreground">
              روابط سريعة
            </h4>
            <ul className="mt-4 space-y-2.5">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group inline-flex items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    <MiniCell
                      animated={false}
                      className="size-4 text-primary/45 transition-colors group-hover:text-primary"
                    />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-4">
            <h4 className="text-sm font-extrabold text-foreground">
              تواصل معانا
            </h4>
            <ul className="mt-3 space-y-1">
              {contact.whatsappLink && (
                <ContactRow
                  href={contact.whatsappLink}
                  icon={IconWhatsapp}
                  label="واتساب"
                  value={contact.whatsapp}
                  external
                  ltr
                />
              )}
              {contact.telLink && (
                <ContactRow
                  href={contact.telLink}
                  icon={IconPhone}
                  label="هاتف"
                  value={contact.phone}
                  ltr
                />
              )}
              {contact.email && (
                <ContactRow
                  href={`mailto:${contact.email}`}
                  icon={IconMail}
                  label="الإيميل"
                  value={contact.email}
                  ltr
                  stroke
                />
              )}
              {contact.facebook && (
                <ContactRow
                  href={contact.facebook}
                  icon={IconFacebook}
                  label="فيسبوك"
                  value={`صفحة ${SITE.teacherShort}`}
                  external
                />
              )}
            </ul>
          </div>
        </div>

        <PaymentMethods />

        <div className="flex flex-col items-center justify-between gap-2 border-t border-border bg-muted/40 px-6 py-4 text-xs text-muted-foreground sm:flex-row sm:px-10">
          <p>
            © {new Date().getFullYear()} {SITE.brandShort} — جميع الحقوق محفوظة.
          </p>
          {/* The developer's signature: one chip, opens a WhatsApp chat. */}
          <a
            href={SITE.developer.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${SITE.developer.credit} ${SITE.developer.name} — كلّمه على واتساب ${SITE.developer.phone}`}
            className="group inline-flex items-center gap-3 rounded-full border border-border bg-card py-1 pe-1 ps-4 shadow-soft transition-colors hover:border-primary/40"
          >
            <span className="flex flex-col whitespace-nowrap leading-tight">
              <span className="text-[10px] text-muted-foreground">
                {SITE.developer.credit}
              </span>
              <span className="text-xs font-extrabold text-foreground transition-colors group-hover:text-primary">
                {SITE.developer.name}
              </span>
            </span>
            {/* WhatsApp green in every palette; deep enough for white text. */}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green-700 px-3 py-2 text-white transition-colors group-hover:bg-green-800">
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                {IconWhatsapp}
              </svg>
              <span dir="ltr" className="font-mono text-[11px] font-bold">
                {SITE.developer.phone}
              </span>
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
