import type { Metadata } from "next";
import { PlayerView } from "@/features/player/PlayerView";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `مشاهدة: ${slug}`,
    // Behind login and paid — nothing here for search engines.
    robots: { index: false, follow: false },
  };
}

export default async function PlayerPage({ params }: PageProps) {
  const { slug } = await params;
  return <PlayerView slug={slug} />;
}
