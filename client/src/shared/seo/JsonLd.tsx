import { jsonLd } from "./seo";

/** Renders schema.org structured data into the page's HTML (server-rendered). */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  );
}
