/**
 * Removes ONLY the demo data created by seedDemoCourses.ts (courses/lessons
 * whose slug starts with "demo-"). Real courses are never touched.
 *
 * Run from the server/ directory (uses the MONGODB_URI in server/.env):
 *   npx tsx src/seeds/cleanupDemoCourses.ts
 */
import { connectDatabase, disconnectDatabase } from "../config/database";
import { Course } from "../modules/courses/course.model";
import { Lesson } from "../modules/lessons/lesson.model";
import { logger } from "../shared/utils/logger";

const DEMO_PREFIX = "demo-";

async function main(): Promise<void> {
  await connectDatabase();

  const demo = await Course.find({ slug: new RegExp("^" + DEMO_PREFIX) })
    .select("_id")
    .lean();
  const ids = demo.map((c) => c._id);

  const lessonsDeleted = ids.length
    ? (await Lesson.deleteMany({ courseId: { $in: ids } })).deletedCount
    : 0;
  const coursesDeleted = ids.length
    ? (await Course.deleteMany({ _id: { $in: ids } })).deletedCount
    : 0;

  logger.info(
    `[cleanupDemoCourses] deleted ${coursesDeleted} demo courses and ${lessonsDeleted} demo lessons.`,
  );
  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  logger.error("[cleanupDemoCourses] failed", { error: err });
  process.exit(1);
});
