import dns from "dns";
import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../shared/utils/logger";

// Reject queries for fields not defined in the schema.
// Prevents accidental typos from silently querying nothing.
mongoose.set("strictQuery", true);

// Optional: override Node's default DNS resolver with custom servers.
// Useful when MongoDB Atlas is behind a custom VPN or private DNS.
if (env.DNS_SERVERS) {
  const servers = env.DNS_SERVERS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length > 0) {
    dns.setServers(servers);
    logger.info(`Using custom DNS servers: ${servers.join(", ")}`);
  }
}

/**
 * Opens the Mongoose connection to MongoDB.
 * autoIndex is off everywhere: the server creates every declared index itself
 * at startup (config/indexes.ts), the same way in development and production.
 * family: 4 forces IPv4 to avoid issues on systems that prefer IPv6.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      autoIndex: false,                           // see config/indexes.ts
      serverSelectionTimeoutMS: 15000,            // fail fast if MongoDB is unreachable
      family: 4,                                  // force IPv4
    });
    logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (error) {
    logger.error("MongoDB connection failed", { error });
    throw error;
  }
}

/** Cleanly closes the Mongoose connection (used during graceful shutdown). */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected");
}

// Connection lifecycle event listeners — log important DB state changes.
mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB reconnected");
});

mongoose.connection.on("error", (err) => {
  logger.error("MongoDB error", { error: err });
});
