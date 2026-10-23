"use client";

import { SiteFooter } from "@/shared/components/SiteFooter";
import { SiteHeader } from "@/shared/components/SiteHeader";
import { PageBackdrop } from "@/shared/components/bio";
import { LoginRequiredPopup } from "@/features/lessons/popups/LoginRequiredPopup";
import { PlayerBreadcrumb } from "./sections/PlayerBreadcrumb";
import { PlayerInfo } from "./sections/PlayerInfo";
import { PlayerProgress } from "./sections/PlayerProgress";
import { PlayerTopics } from "./sections/PlayerTopics";
import { VideoPlayer } from "./sections/VideoPlayer";
import { PlayerProvider, usePlayer } from "./PlayerProvider";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

function PlayerContent() {
  const { loading, blocker, closeBlocker, lesson, slug, videoUrl, videoAttempt } =
    usePlayer();

  if (loading) return <LoadingScreen variant="page" />;

  if (blocker.open) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              مش قادر تشاهد الدرس ده دلوقتي
            </p>
          </div>
        </main>
        <LoginRequiredPopup
          open={blocker.open}
          onClose={closeBlocker}
          reason={blocker.reason}
          message={blocker.message}
        />
        <SiteFooter />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center text-muted-foreground">
          الدرس غير موجود
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <PageBackdrop />
        <PlayerBreadcrumb />
        <VideoPlayer key={`${slug}:${videoUrl ?? ""}:${videoAttempt}`} />
        <PlayerProgress />
        <PlayerInfo />
        <PlayerTopics />
      </main>
      <SiteFooter />
    </div>
  );
}

export function PlayerView({ slug }: { slug: string }) {
  return (
    <PlayerProvider slug={slug}>
      <PlayerContent />
    </PlayerProvider>
  );
}
