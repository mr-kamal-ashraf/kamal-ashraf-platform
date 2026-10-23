import type { Metadata } from "next";
import type { ReactNode } from "react";

/** The admin panel is never shown in search results. */
export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: "%s | لوحة التحكم" },
  robots: { index: false, follow: false },
};

/**
 * Marks every admin page (panel + login). styles.css keys off this marker to
 * keep the admin panel on its own font (Cairo) whatever font the teacher
 * picks for the website. `contents` keeps the wrapper out of the layout.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div data-admin-root className="contents">
      {children}
    </div>
  );
}
