import winston from "winston";

/**
 * Application-wide logger built on Winston.
 *
 * Log levels (lowest → highest severity):
 *   debug → verbose → http → info → warn → error
 *
 * In development: human-friendly single-line format with timestamp and metadata.
 * In production:  structured JSON for log aggregators (Datadog, CloudWatch, etc.).
 *
 * Usage anywhere in the codebase:
 *   import { logger } from "./logger";
 *   logger.info("User logged in", { userId });
 *   logger.error("DB query failed", { error });
 */

const isProduction = process.env.NODE_ENV === "production";

// Build the format pipeline used by every transport.
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),  // add readable timestamp
  winston.format.errors({ stack: true }),                        // include stack trace for errors
  winston.format.splat(),                                        // support printf-style %s %d interpolation
  isProduction
    ? winston.format.json()           // machine-parseable JSON in production
    : winston.format.printf((info) => {
        // Human-readable format: "2024-01-01 12:00:00 [INFO]: message {meta}"
        const { timestamp, level, message, ...meta } = info;
        const metaStr = Object.keys(meta).length
          ? ` ${JSON.stringify(meta)}`
          : "";
        return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
      })
);

export const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",  // log everything in dev, info+ in prod
  format: logFormat,
  defaultMeta: { service: "kamal-ashraf-server" },  // tag every log entry with the service name
  transports: [new winston.transports.Console()],   // write to stdout (captured by PM2/Docker)
});

export default logger;
