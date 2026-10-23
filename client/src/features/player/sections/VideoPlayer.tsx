"use client";

import { useEffect, useRef, useState } from "react";
import "plyr/dist/plyr.css";
import { BtnNucleus } from "@/shared/ui/Button";
import { usePlayer } from "../PlayerProvider";

/** Strip query + hash so `.m3u8` detection works when the URL has ?token=… */
function urlPathWithoutQueryOrHash(href: string): string {
  const noHash = href.split("#")[0] ?? href;
  const q = noHash.indexOf("?");
  return q === -1 ? noHash : noHash.slice(0, q);
}

function isHlsPlaylistUrl(href: string): boolean {
  return urlPathWithoutQueryOrHash(href).toLowerCase().endsWith(".m3u8");
}

/**
 * Plyr reads `document` at import time — we must not static-import it (breaks SSR
 * and can break bundling when mixed with dynamic routes). Hls is loaded the same way.
 * No `poster` on <video>: user sees the real player chrome, not the lesson thumbnail.
 */
export function VideoPlayer() {
  const { lesson, videoUrl, progress, videoRef, videoNotice, retryVideo, retrying } =
    usePlayer();
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const resumeSecond = progress?.lastWatchedSecond ?? null;
  // The video stopped loading for good (after the player's own retries).
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!videoUrl) return;

    let cancelled = false;
    let rafId = 0;
    let playerInstance: { destroy: () => void } | null = null;

    const teardown = () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      try {
        playerInstance?.destroy();
      } catch {
        /* Plyr may already be destroyed */
      }
      playerInstance = null;
    };

    void (async () => {
      try {
        let attempts = 0;
        // Plyr/Hls are CommonJS-interop modules — depending on the bundler the
        // module shape can be either `{ default: X }` or `X` itself, so we
        // resolve both safely instead of destructuring `.default`.
        const [plyrModule, hlsModule] = await Promise.all([
          import("plyr"),
          import("hls.js"),
        ]);
        const Plyr = (plyrModule as { default?: typeof import("plyr").default })
          .default ?? (plyrModule as unknown as typeof import("plyr").default);
        const Hls = (hlsModule as { default?: typeof import("hls.js").default })
          .default ?? (hlsModule as unknown as typeof import("hls.js").default);
        if (cancelled) return;

        const run = () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (!video) {
            attempts += 1;
            if (attempts < 120) {
              rafId = requestAnimationFrame(run);
            }
            return;
          }

          playerInstance = new Plyr(video, {
          // Served from our own site — Plyr's defaults fetch these from
          // cdn.plyr.io (the icon sprite on every lesson, the blank clip it
          // loads to cancel downloads when the player is torn down).
          iconUrl: "/assets/player/plyr.svg",
          blankVideo: "/assets/player/blank.mp4",
          controls: [
            "play-large",
            "rewind",
            "play",
            "fast-forward",
            "progress",
            "current-time",
            "duration",
            "mute",
            "volume",
            "settings",
            "fullscreen",
          ],
          settings: ["quality", "speed"],
          speed: {
            selected: 1,
            options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
          },
          quality: {
            default: 720,
            options: [1080, 720, 480, 360],
            forced: false,
            onChange: (quality: number) => {
              if (hlsRef.current) {
                const idx = hlsRef.current.levels.findIndex(
                  (l) => l.height === quality,
                );
                if (idx !== -1) hlsRef.current.currentLevel = idx;
              }
            },
          },
          i18n: {
            restart: "إعادة",
            rewind: "رجوع {seektime} ثانية",
            play: "تشغيل",
            pause: "إيقاف",
            fastForward: "تقديم {seektime} ثانية",
            seek: "بحث",
            seekLabel: "{currentTime} من {duration}",
            played: "تم التشغيل",
            buffered: "تم التحميل",
            currentTime: "الوقت الحالي",
            duration: "المدة",
            volume: "الصوت",
            mute: "كتم",
            unmute: "إلغاء الكتم",
            enableCaptions: "تفعيل الترجمة",
            disableCaptions: "إلغاء الترجمة",
            download: "تحميل",
            enterFullscreen: "ملء الشاشة",
            exitFullscreen: "إلغاء ملء الشاشة",
            frameTitle: "مشغل {title}",
            captions: "الترجمة",
            settings: "الإعدادات",
            pip: "صورة في صورة",
            menuBack: "رجوع",
            speed: "السرعة",
            normal: "عادي",
            quality: "الجودة",
            loop: "تكرار",
            start: "البداية",
            end: "النهاية",
            all: "الكل",
            reset: "إعادة ضبط",
            disabled: "معطل",
            enabled: "مفعل",
            advertisement: "إعلان",
            qualityBadge: {
              2160: "4K",
              1440: "HD",
              1080: "HD",
              720: "HD",
              576: "SD",
              480: "SD",
            },
          },
          tooltips: { controls: true, seek: true },
          keyboard: { focused: true, global: true },
          seekTime: 10,
          invertTime: false,
          disableContextMenu: true,
        });

        if (Hls.isSupported() && isHlsPlaylistUrl(videoUrl)) {
          let masterOrigin = "";
          let masterHostname = "";
          const authParams = new URLSearchParams();
          try {
            const master = new URL(videoUrl);
            masterOrigin = master.origin;
            masterHostname = master.hostname;
            const token = master.searchParams.get("token");
            const expires = master.searchParams.get("expires");
            if (token && expires) {
              authParams.set("token", token);
              authParams.set("expires", expires);
              const tokenPath = master.searchParams.get("token_path");
              if (tokenPath) authParams.set("token_path", tokenPath);
            }
          } catch {
            /* leave authParams empty */
          }

          const hls = new Hls({
            xhrSetup: (xhr, requestUrl) => {
              xhr.withCredentials = false;
              if (
                !masterOrigin ||
                !masterHostname ||
                [...authParams.keys()].length === 0
              )
                return;
              try {
                const req = new URL(requestUrl, masterOrigin);
                if (req.hostname !== masterHostname) return;
                if (req.searchParams.has("token")) return;
                for (const [k, v] of authParams.entries()) {
                  req.searchParams.set(k, v);
                }
                xhr.open("GET", req.toString(), true);
              } catch {
                /* keep default XHR URL */
              }
            },
          });
          // hls.js already retried before calling an error fatal. Give a lost
          // connection and a broken stream one more try each, then show a
          // message instead of leaving a black screen.
          let reloaded = false;
          let recovered = false;
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal || cancelled) return;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !reloaded) {
              reloaded = true;
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
              recovered = true;
              hls.recoverMediaError();
            } else {
              hls.destroy();
              hlsRef.current = null;
              setFailed(true);
            }
          });
          hlsRef.current = hls;
          hls.attachMedia(video);
          hls.loadSource(videoUrl);
        } else {
          // Safari plays HLS itself.
          video.addEventListener(
            "error",
            () => {
              if (!cancelled) setFailed(true);
            },
            { once: true },
          );
          video.src = videoUrl;
        }

          if (resumeSecond != null && resumeSecond > 0) {
            const onLoadedMetadata = () => {
              video.currentTime = resumeSecond;
            };
            video.addEventListener("loadedmetadata", onLoadedMetadata, {
              once: true,
            });
          }
        };

        run();
      } catch {
        /* dynamic import or init failed — avoid breaking the page */
      }
    })();

    return teardown;
  }, [videoUrl, resumeSecond, videoRef]);

  const retryButton = (
    <button
      type="button"
      onClick={() => void retryVideo()}
      disabled={retrying}
      className="btn btn-primary"
    >
      <BtnNucleus />
      {retrying ? "لحظة..." : "جرّب تاني"}
    </button>
  );

  if (lesson && videoNotice) {
    const processing = videoNotice.kind === "processing";
    return (
      <div className="plyr-container overflow-hidden rounded-3xl border border-border shadow-elegant">
        <div
          role="status"
          className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white"
        >
          {processing && (
            <span
              aria-hidden
              className="size-8 animate-spin rounded-full border-2 border-white/25 border-t-white"
            />
          )}
          <p className="text-base font-extrabold sm:text-lg">
            {processing ? "الفيديو لسه بيتجهز" : "الفيديو مش متاح دلوقتي"}
          </p>
          <p className="max-w-md text-sm leading-relaxed text-white/75">
            {videoNotice.message}
          </p>
          {retryButton}
        </div>
      </div>
    );
  }

  if (!lesson || !videoUrl) return null;

  return (
    <div className="plyr-container relative overflow-hidden rounded-3xl border border-border shadow-elegant">
      <div className="aspect-video w-full bg-black">
        <video
          ref={videoRef}
          className="h-full w-full"
          playsInline
          preload="auto"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      {failed && (
        <div
          role="alert"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center text-white"
        >
          <p className="text-base font-extrabold sm:text-lg">
            الفيديو مش قادر يشتغل دلوقتي
          </p>
          <p className="max-w-md text-sm leading-relaxed text-white/75">
            غالباً مشكلة في الإنترنت — اتأكد إنك متصل وجرّب تاني.
          </p>
          {retryButton}
        </div>
      )}
    </div>
  );
}
