/**
 * Demo seeder — inserts fake courses + lessons (NO images / NO videos) so the
 * platform looks populated for a walkthrough with the teacher.
 *
 * Everything it creates is marked by the slug prefix "demo-", so
 * cleanupDemoCourses.ts can safely remove ONLY this demo data and never touch
 * real courses.
 *
 * Run from the server/ directory (uses the MONGODB_URI in server/.env):
 *   npx tsx src/seeds/seedDemoCourses.ts
 */
import { connectDatabase, disconnectDatabase } from "../config/database";
import { Course } from "../modules/courses/course.model";
import { Lesson } from "../modules/lessons/lesson.model";
import { STAGES, type Stage } from "../config/constants";
import { logger } from "../shared/utils/logger";

const DEMO_PREFIX = "demo-";

interface DemoCourse {
  stage: Stage;
  title: string;
  price: number;
  lessons: string[];
}

const DEMO_COURSES: DemoCourse[] = [
  // ── الصف الثالث الإعدادي ──
  { stage: STAGES.PREP3, title: "التكاثر واستمرار النوع", price: 120, lessons: ["الانقسام الميتوزي", "الانقسام الميوزي", "التكاثر في النبات الزهري", "التكاثر في الإنسان", "تدريبات ومراجعة"] },
  { stage: STAGES.PREP3, title: "الوراثة — انتقال الصفات", price: 120, lessons: ["الصفات الوراثية", "تجارب مندل", "الكروموسومات والجينات", "مسائل الوراثة"] },
  { stage: STAGES.PREP3, title: "الحفريات وحماية الأنواع من الانقراض", price: 100, lessons: ["تكوّن الحفريات", "أنواع الحفريات وأهميتها", "الانقراض وأسبابه", "حماية الأنواع"] },
  // ── الصف الأول الثانوي ──
  { stage: STAGES.SEC1, title: "الأساس الكيميائي للحياة", price: 150, lessons: ["الماء والأملاح المعدنية", "الكربوهيدرات", "البروتينات والإنزيمات", "الليبيدات والأحماض النووية", "تطبيقات ومراجعة"] },
  { stage: STAGES.SEC1, title: "الخلية — التركيب والوظيفة", price: 150, lessons: ["نظرية الخلية والميكروسكوب", "الغشاء البلازمي", "عضيات الخلية", "الخلية النباتية والحيوانية", "انقسام الخلية"] },
  { stage: STAGES.SEC1, title: "الأنسجة النباتية والحيوانية", price: 130, lessons: ["الأنسجة الإنشائية", "الأنسجة المستديمة", "الأنسجة الطلائية والضامة", "الأنسجة العضلية والعصبية"] },
  { stage: STAGES.SEC1, title: "التنوع وتصنيف الكائنات الحية", price: 120, lessons: ["أسس التصنيف", "التسمية الثنائية", "الممالك الحية", "مراجعة شاملة"] },
  // ── الصف الثالث الثانوي ──
  { stage: STAGES.SEC3, title: "الدعامة والحركة", price: 220, lessons: ["الدعامة في النبات", "الهيكل العظمي في الإنسان", "المفاصل", "العضلات وآلية الانقباض", "امتحانات سابقة"] },
  { stage: STAGES.SEC3, title: "التنسيق الهرموني والمناعة", price: 220, lessons: ["الهرمونات في النبات", "الغدد الصماء في الإنسان", "الجهاز المناعي", "الاستجابة المناعية"] },
  { stage: STAGES.SEC3, title: "الحمض النووي DNA وتخليق البروتين", price: 250, lessons: ["تركيب الـ DNA", "تضاعف الـ DNA", "الـ RNA وأنواعه", "تخليق البروتين", "الهندسة الوراثية", "المراجعة النهائية"] },
  { stage: STAGES.SEC3, title: "الجيولوجيا — المعادن والصخور", price: 200, lessons: ["الخواص الفيزيائية للمعادن", "الصخور النارية", "الصخور الرسوبية", "الصخور المتحولة"] },
  { stage: STAGES.SEC3, title: "الجيولوجيا — التراكيب والعمليات الأرضية", price: 200, lessons: ["الطيات والفوالق", "التجوية والتعرية", "الزلازل والبراكين", "مراجعة نهائية"] },
];

function courseSlug(ci: number): string {
  return `${DEMO_PREFIX}course-${ci + 1}`;
}
function lessonSlug(ci: number, li: number): string {
  return `${DEMO_PREFIX}lesson-${ci + 1}-${li + 1}`;
}

/** Clears any previously seeded demo data first, so re-running is safe. */
async function removeExistingDemo(): Promise<void> {
  const existing = await Course.find({ slug: new RegExp("^" + DEMO_PREFIX) })
    .select("_id")
    .lean();
  const ids = existing.map((c) => c._id);
  if (ids.length) {
    await Lesson.deleteMany({ courseId: { $in: ids } });
    await Course.deleteMany({ _id: { $in: ids } });
  }
}

async function main(): Promise<void> {
  await connectDatabase();
  await removeExistingDemo();

  const now = new Date();
  let courseCount = 0;
  let lessonCount = 0;

  for (let ci = 0; ci < DEMO_COURSES.length; ci++) {
    const c = DEMO_COURSES[ci];
    const course = await Course.create({
      title: c.title,
      slug: courseSlug(ci),
      description: `كورس تجريبي للعرض — ${c.title}`,
      longDescription:
        "ده كورس تجريبي (Demo) اتحطّ للعرض بس عشان يوضّح شكل المنصة. المحتوى مؤقّت ومن غير فيديوهات.",
      stage: c.stage,
      price: c.price,
      thumbnail: null,
      thumbnailGradient: null,
      isPublished: true,
      order: ci,
    });
    courseCount++;

    for (let li = 0; li < c.lessons.length; li++) {
      await Lesson.create({
        courseId: course._id,
        title: c.lessons[li],
        slug: lessonSlug(ci, li),
        description: `درس تجريبي للعرض — ${c.lessons[li]}`,
        longDescription: "ده درس تجريبي (Demo) للعرض بس، من غير فيديو.",
        stage: c.stage,
        durationMinutes: 25 + ((li * 7) % 35),
        chapters: 1 + (li % 3),
        topics: [],
        bunnyVideoId: null,
        videoDurationSeconds: 0,
        thumbnail: null,
        thumbnailGradient: null,
        isPublished: true,
        publishedAt: now,
        order: li,
      });
      lessonCount++;
    }
  }

  logger.info(
    `[seedDemoCourses] created ${courseCount} demo courses and ${lessonCount} demo lessons.`,
  );
  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  logger.error("[seedDemoCourses] failed", { error: err });
  process.exit(1);
});
