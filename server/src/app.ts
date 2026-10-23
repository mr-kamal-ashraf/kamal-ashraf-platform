import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";

import { env } from "./config/env";
import { generalLimiter } from "./shared/middlewares/rateLimit.middleware";
import { errorMiddleware } from "./shared/middlewares/error.middleware";
import { notFoundMiddleware } from "./shared/middlewares/notFound.middleware";
import { logger } from "./shared/utils/logger";
import { PERSISTENT_UPLOAD_ROOT } from "./shared/middlewares/upload.middleware";
import apiRouter from "./routes";

/**
 * Creates and configures the Express application.
 * All middleware is registered here in a deliberate order:
 *   1. Security headers (Helmet)
 *   2. CORS
 *   3. Body parsers + cookie parser
 *   4. Compression
 *   5. Security sanitisers (NoSQL injection, HTTP parameter pollution)
 *   6. HTTP request logger (Morgan)
 *   7. Global rate limiter
 *   8. Static file serving (uploads/)
 *   9. API routes
 *  10. 404 catch-all
 *  11. Global error handler (must be last)
 */
export function createApp(): Express {
  const app = express();

  // Tell Express to trust the first reverse proxy (e.g. Nginx / Railway)
  // so req.ip returns the real client IP, not the proxy IP.
  app.set("trust proxy", 1);

  // Helmet sets ~14 security-related HTTP headers (X-Frame-Options, CSP, etc.).
  // crossOriginResourcePolicy is relaxed so CDN-hosted images can be loaded.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // CORS: only allow requests from the configured client origin.
  // Credentials (cookies) are enabled because we use HttpOnly cookie auth.
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
  );

  // Parse JSON and URL-encoded request bodies; cap at 10 MB to prevent abuse.
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  // Parse cookies sent with every request (used for auth tokens).
  app.use(cookieParser());
  // Compress response bodies (gzip/deflate) to reduce bandwidth usage.
  app.use(compression());

  // Strip MongoDB operators ($gt, $where, etc.) from req.body/params/query
  // to prevent NoSQL injection attacks.
  app.use(mongoSanitize());
  // Block HTTP Parameter Pollution — prevent duplicate query params from
  // overriding each other in unexpected ways.
  app.use(hpp());

  // Log each HTTP request. In production use Apache "combined" format for
  // log aggregators; in dev use concise colorised "dev" format.
  // Skipped entirely during tests to keep test output clean.
  if (env.NODE_ENV !== "test") {
    app.use(
      morgan(env.NODE_ENV === "production" ? "combined" : "dev", {
        stream: {
          write: (msg) => logger.http?.(msg.trim()) ?? logger.info(msg.trim()),
        },
      }),
    );
  }

  // Apply the global rate limiter to every route.
  // Tighter limiters (authLimiter, progressLimiter) are applied per-router.
  app.use(generalLimiter);

  // Root endpoint — simple liveness check / API identifier.
  app.get("/", (_req, res) => {
    res.json({
      success: true,
      message: "Mr. Kamal Ashraf Platform API",
      version: "1.0.0",
      docs: `${env.API_PREFIX}/health`,
    });
  });

  // Serve static files from the uploads/ directory.
  // In production, assets are cached for 30 days via Cache-Control max-age.
  app.use(
    "/uploads",
    express.static(PERSISTENT_UPLOAD_ROOT, {
      maxAge: env.NODE_ENV === "production" ? "30d" : 0,
      etag: true,
      fallthrough: true,
    }),
  );

  // API output may vary by the caller's HttpOnly session (for example the
  // `owned` flag on courses). Never reuse an anonymous or authenticated API
  // response for a later request with a different session state.
  app.use(
    env.API_PREFIX,
    (_req, res, next) => {
      res.set("Cache-Control", "no-store, private");
      next();
    },
    apiRouter,
  );

  // Catch any route not matched above and convert to a 404 ApiError.
  app.use(notFoundMiddleware);
  // Convert every thrown/passed error into a structured JSON response.
  // Must be the LAST middleware registered.
  app.use(errorMiddleware);

  return app;
}
