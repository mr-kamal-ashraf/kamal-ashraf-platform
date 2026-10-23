import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { logger } from "./shared/utils/logger";
import { seedAdmin } from "./seeds/seedAdmin";
import { callRegisterPlatform } from "./modules/ai/ai.service";
import { ensureAiJobIndexes } from "./modules/ai/ai-job.model";
import {
  activeJobCount,
  waitForActiveJobs,
} from "./modules/ai/ai-jobs.service";
import {
  initWhatsappBridge,
  shutdownWhatsappBridge,
} from "./modules/whatsapp-bridge/whatsapp-bridge.service";

/**
 * Application entry point. Runs in sequence:
 *   1. Connect to MongoDB.
 *   2. Seed the default admin account if none exists.
 *   3. Create the Express app and start listening.
 *   4. Register OS signal handlers for graceful shutdown.
 */
/** How long a shutdown waits for AI jobs that are still running. */
const JOB_DRAIN_MS = 60_000;

async function bootstrap() {
  try {
    await connectDatabase();
    // Creates the admin user from .env if the collection is empty.
    await seedAdmin();
    // The TTL index that clears finished AI jobs (autoIndex is off in production).
    await ensureAiJobIndexes().catch((error) =>
      logger.error("Could not create the AI jobs TTL index", { error }),
    );

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info(
        `Server running on port ${env.PORT} (${env.NODE_ENV}) — http://localhost:${env.PORT}`,
      );

      // Fire-and-forget: tell n8n's shared `platforms` registry (WF11) that
      // this teacher's backend is up and where to reach it. This never
      // blocks or fails startup — see callRegisterPlatform for retry/error
      // handling. Without this call, WF7's daily sweep will never find this
      // platform's students.
      void callRegisterPlatform();

      // Fire-and-forget: bring up the in-process WhatsApp bridge (Baileys).
      // Never blocks or fails startup — if WhatsApp has a problem the API
      // still serves normally, and sends become logged no-ops until the
      // number is linked (scan the QR from the admin panel: WhatsApp page).
      void initWhatsappBridge();
    });

    /**
     * Graceful shutdown handler.
     * Stops accepting new connections, waits for in-flight requests to finish,
     * then closes the DB connection and exits cleanly.
     * A 10-second hard timeout forces an exit if something hangs.
     */
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      // AI answers still being produced in the background (student chat, exam
      // generation) are not HTTP requests, so server.close() does not wait for
      // them: give them a chance to finish before the process goes away.
      const jobsRunning = activeJobCount();
      if (jobsRunning > 0) {
        logger.info(
          `Waiting up to ${JOB_DRAIN_MS / 1000}s for ${jobsRunning} AI job(s) to finish`,
        );
      }
      server.close(async () => {
        await waitForActiveJobs(JOB_DRAIN_MS);
        await shutdownWhatsappBridge();
        await disconnectDatabase();
        process.exit(0);
      });

      // Force-exit if graceful shutdown takes too long (10 s, plus the drain
      // time when AI jobs are still running).
      setTimeout(
        () => {
          logger.error("Forced shutdown after timeout");
          process.exit(1);
        },
        10_000 + (jobsRunning > 0 ? JOB_DRAIN_MS : 0),
      ).unref();
    };

    // Handle Kubernetes/Docker SIGTERM (normal pod termination).
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    // Handle Ctrl+C during local development.
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Log unhandled promise rejections without crashing the process.
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection", { reason });
    });

    // Uncaught exceptions are fatal — log then shut down to avoid corrupt state.
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception", { error });
      gracefulShutdown("uncaughtException");
    });
  } catch (err) {
    logger.error("Bootstrap failed", { error: err });
    process.exit(1);
  }
}

bootstrap();
