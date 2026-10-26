import { isBunnyConfigured } from "../bunny/bunny.client";
import { announcePublishedLessons } from "../notifications/lesson-published.service";
import { logger } from "../../shared/utils/logger";
import {
  listLessonsWaitingToPublish,
  settleScheduledPublish,
  syncLessonVideo,
} from "./lesson.service";

/*
 * "Publish when ready" keeps working after the teacher closes the page: every
 * half minute, the lessons waiting for their video (usually none, a handful at
 * most) are checked, and each one is published the moment its video is ready.
 * A page that's watching publishes it sooner (adminVideoStatus); publishing
 * is claimed atomically, so students are told once even with several servers.
 */

const CHECK_EVERY_MS = 30_000;
/** Lessons looked at per round — the rest wait for the next one. */
const PER_ROUND = 20;

let timer: NodeJS.Timeout | null = null;
let checking = false;

async function checkWaitingLessons(): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    const waiting = await listLessonsWaitingToPublish(PER_ROUND);
    for (const lesson of waiting) {
      try {
        // Not forced: a lesson's video is asked about at most every few seconds.
        const { status } = await syncLessonVideo(lesson);
        if (await settleScheduledPublish(lesson, status)) {
          logger.info("Published a lesson once its video was ready", {
            lessonId: String(lesson._id),
          });
          void announcePublishedLessons([lesson]);
        }
      } catch (error) {
        logger.warn("Could not check a lesson waiting to be published", {
          lessonId: String(lesson._id),
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  } catch (error) {
    logger.error("Could not look for lessons waiting to be published", {
      error: error instanceof Error ? error.message : error,
    });
  } finally {
    checking = false;
  }
}

/** Starts the background check (no video service configured: nothing to wait for). */
export function startLessonPublishWatcher(): void {
  if (timer || !isBunnyConfigured()) return;
  timer = setInterval(() => void checkWaitingLessons(), CHECK_EVERY_MS);
  timer.unref();
}

export function stopLessonPublishWatcher(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
