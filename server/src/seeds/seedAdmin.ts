import bcrypt from "bcryptjs";
import { Admin } from "../modules/admins/admin.model";
import { env } from "../config/env";
import { logger } from "../shared/utils/logger";

/**
 * Creates the initial admin account from environment variables on first startup.
 *
 * Safety checks:
 *  1. If an admin with ADMIN_EMAIL already exists — skip (idempotent).
 *  2. If ANY admin exists but not with ADMIN_EMAIL — skip to avoid duplicates
 *     (the admin was probably renamed manually in the DB).
 *  3. Only if the admins collection is completely empty does it create one.
 *
 * This function is called in server.ts before the HTTP server starts listening.
 */
export async function seedAdmin(): Promise<void> {
  try {
    // Check if the configured admin email already has an account.
    const existing = await Admin.findOne({
      email: env.ADMIN_EMAIL.toLowerCase(),
    });
    if (existing) {
      logger.info(`Admin already exists (${existing.email}) — skipping seed`);
      return;
    }

    // Safety: if there are other admins in the DB, don't seed to avoid conflicts.
    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      logger.warn(
        `Admin collection has ${adminCount} record(s) but none with the configured ADMIN_EMAIL. Skipping seed to avoid duplicates.`,
      );
      return;
    }

    // Hash the password before storing.
    const passwordHash = await bcrypt.hash(
      env.ADMIN_PASSWORD,
      env.BCRYPT_SALT_ROUNDS,
    );

    await Admin.create({
      email: env.ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      name: env.ADMIN_NAME,
    });

    logger.info(`Admin account seeded successfully: ${env.ADMIN_EMAIL}`);
  } catch (error) {
    logger.error("Failed to seed admin", { error });
    throw error; // re-throw so the bootstrap function knows seeding failed
  }
}
