import mongoose from "mongoose";
import { logger } from "../shared/utils/logger";

/*
 * Every index the models declare — the unique rules (one account per phone,
 * one enrollment per student and course, one use per code…), the lookups the
 * lists rely on, and the TTLs that clear old rows — is created at startup,
 * the same way in development and production (Mongoose's autoIndex is off in
 * both, so a missing index shows up in development first).
 *
 * createIndex does nothing for an index that's already there, so after the
 * first start this costs a quick round trip per index; nothing is ever
 * dropped. An index that can't be created (old duplicate rows blocking a
 * unique rule, or an older index on the same fields with other options) is
 * logged with what to do, and the rest still go on — the server starts.
 */

export interface IndexFailure {
  model: string;
  index: string;
  reason: string;
}

/** What blocked an index, and how to clear it. */
function explain(error: unknown): string {
  const e = error as { code?: number; message?: string };
  if (e?.code === 11000) {
    return "duplicate rows break this unique rule — remove the duplicates, then restart";
  }
  if (e?.code === 85 || e?.code === 86) {
    return "an older index on these fields has other options — drop it, then restart";
  }
  return e?.message ?? String(error);
}

/** Creates the models' indexes; returns the ones that couldn't be. */
export async function ensureIndexes(): Promise<IndexFailure[]> {
  const startedAt = Date.now();
  const failures: IndexFailure[] = [];
  let count = 0;

  // Collections side by side; one collection's indexes one after another.
  await Promise.all(
    Object.values(mongoose.models).map(async (model) => {
      for (const [fields, options] of model.schema.indexes()) {
        count += 1;
        try {
          // Mongoose's own index shape is the driver's (types differ only in name).
          await model.collection.createIndex(
            fields as mongoose.mongo.IndexSpecification,
            options as mongoose.mongo.CreateIndexesOptions,
          );
        } catch (error) {
          failures.push({ model: model.modelName, index: JSON.stringify(fields), reason: explain(error) });
        }
      }
    }),
  );

  for (const failure of failures) {
    logger.error(`Index not created: ${failure.model} ${failure.index}`, { reason: failure.reason });
  }
  logger.info(
    `Indexes checked: ${count - failures.length}/${count} in ${Date.now() - startedAt} ms`,
  );
  return failures;
}
