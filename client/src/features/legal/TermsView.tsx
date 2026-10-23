import { SiteHeader } from "@/shared/components/SiteHeader";
import { SiteFooter } from "@/shared/components/SiteFooter";
import { PageBackdrop } from "@/shared/components/bio";
import { SITE } from "@/shared/i18n/site";

const TEACHER = SITE.teacherName;

interface Section {
  title: string;
  body?: string[];
  listIntro?: string;
  list?: string[];
  listOutro?: string;
  note?: string;
}

const SECTIONS: Section[] = [
  {
    title: "الموافقة على الشروط",
    body: [
      `باستخدامك لهذا الموقع، أو شرائك لأي كورس، أو مشاهدتك لأي محتوى تعليمي يقدّمه ${TEACHER} (ويُشار إليه في هذه الشروط بـ«نحن» أو «المنصة»)، فإنك توافق على الالتزام بهذه الشروط والأحكام وتُعدّ ملزمًا بها قانونيًا.`,
    ],
    note: "إذا كنت لا توافق على هذه الشروط، يجب عليك عدم استخدام الموقع أو خدماته.",
  },
  {
    title: "حقوق الملكية الفكرية",
    body: [
      `يملك ${TEACHER} حقوقًا حصرية في كل المحتوى المتاح على هذا الموقع، وهو محمي بموجب قوانين حقوق النشر والعلامات التجارية والملكية الفكرية وغيرها من القوانين المعمول بها.`,
    ],
    listIntro: "ويشمل ذلك على سبيل المثال لا الحصر:",
    list: [
      "الكورسات الأونلاين",
      "فيديوهات الشرح والتسجيلات",
      "الشعار والهوية البصرية",
      "الرسومات والتصميمات",
      "المحتوى المكتوب على الموقع",
      "ترتيب الدروس وطريقة الشرح",
      "العلامات التجارية والأسماء والشعارات النصية",
    ],
    listOutro:
      "ويُمنع منعًا باتًا أي استخدام أو نسخ أو إعادة إنتاج أو توزيع أو تعديل أو نشر أو إعادة بيع أو مشاركة لأي محتوى دون إذن.",
  },
  {
    title: "ترخيص استخدام المحتوى",
    body: [
      "عند شرائك لكورس أو حصولك على صلاحية مشاهدته، تحصل على ترخيص محدود وغير حصري وغير قابل للتحويل وقابل للإلغاء، للاستخدام التعليمي الشخصي فقط.",
    ],
    listIntro: "ولا يُسمح لك بـ:",
    list: [
      "مشاركة بيانات الدخول لحسابك مع أي شخص",
      "تسجيل فيديوهات الكورسات أو نسخها أو تحميلها دون إذن",
      "رفع محتوى الكورسات على أي منصة أخرى",
      "إعادة توزيع المحتوى بشكل علني أو خاص",
      "استخدام المحتوى لأي غرض تجاري",
      "إعادة إنتاج صوت المدرس أو صورته أو مواده التعليمية",
      "إنشاء أعمال مشتقة من الكورسات",
      "إعادة بيع أي جزء من المحتوى",
      "استخدام أدوات الذكاء الاصطناعي لتقليد صوت المدرس أو صورته أو أسلوب شرحه أو محتواه",
    ],
    note: "أي استخدام غير مصرّح به قد يؤدي إلى إيقاف الوصول فورًا واتخاذ الإجراءات القانونية.",
  },
  {
    title: "الحماية من التوزيع غير المصرّح به",
    listIntro: "يُمنع منعًا باتًا على المستخدمين:",
    list: [
      "إعادة نشر محتوى الكورسات على المواقع أو السوشيال ميديا أو المنتديات أو المتاجر الإلكترونية",
      "مشاركة المحتوى عبر تليجرام أو واتساب أو ديسكورد أو Dropbox أو Google Drive أو أي منصة مشابهة",
      "تسجيل الشاشة أثناء الدروس أو إعادة إنتاجها",
      "استخدام محتوى المنصة في أي منتج تعليمي منافس",
      "نسخ الهوية البصرية أو الشعارات أو عناصر العلامة التجارية",
    ],
    note: "نحتفظ بحق التحقيق في أي مخالفة واتخاذ الإجراءات القانونية، بما في ذلك المطالبة بالتعويضات المالية واستصدار أوامر قضائية بالمنع.",
  },
  {
    title: "حماية العلامة التجارية",
    body: [
      `تعود ملكية كل الشعارات والعلامات التجارية وعلامات الخدمة وأسماء الكورسات وعناصر الهوية المعروضة على هذا الموقع إلى ${TEACHER}.`,
    ],
    note: "لا يحق لأي مستخدم استخدام أو نسخ أو تقليد أو استغلال أي من عناصر العلامة التجارية دون موافقة كتابية مسبقة، وقد يُعد الاستخدام غير المصرّح به تعديًا على العلامة التجارية ومنافسة غير مشروعة.",
  },
  {
    title: "حماية الصوت والصورة من الذكاء الاصطناعي",
    listIntro:
      "لا يجوز للمستخدمين استخدام أي جزء من محتوى المدرس، بما في ذلك الفيديوهات وما فيها من صوت وصورة، والصور، والمحتوى المكتوب، في:",
    list: [
      "تدريب نماذج الذكاء الاصطناعي",
      "استنساخ الصوت",
      "إنشاء فيديوهات مزيفة (Deepfake)",
      "إنتاج وسائط اصطناعية",
      "قواعد بيانات تعلّم الآلة",
      "إعادة إنتاج المحتوى بشكل آلي",
    ],
    note: "يُمنع منعًا باتًا أي محاولة لتقليد صوت المدرس أو شكله أو أسلوب شرحه باستخدام الذكاء الاصطناعي أو أي تقنيات مشابهة.",
  },
  {
    title: "حسابات المستخدمين",
    body: [
      "المستخدم مسؤول عن الحفاظ على سرية حسابه وكلمة المرور الخاصة به.",
      `ويحتفظ ${TEACHER} بحق إيقاف أو إلغاء أي حساب يثبت تورطه في مشاركة غير مصرّح بها أو إساءة استخدام أو مخالفة لهذه الشروط، واتخاذ الإجراءات القانونية اللازمة.`,
    ],
  },
  {
    title: "تحديث الشروط",
    body: [
      `يحتفظ ${TEACHER} بحق تعديل هذه الشروط والأحكام في أي وقت دون إشعار مسبق، ويسري أي تعديل فور نشره على هذه الصفحة.`,
    ],
  },
];

/** /terms — the platform's terms and conditions (static, server-rendered). */
export function TermsView() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="relative flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <PageBackdrop />
        <article className="relative mx-auto max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-10">
          <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
            الشروط والأحكام
          </h1>

          <ol className="mt-8 space-y-8">
            {SECTIONS.map((section, i) => (
              <li key={section.title}>
                <h2 className="text-lg font-extrabold text-foreground">
                  {i + 1}. {section.title}
                </h2>
                {section.body?.map((p) => (
                  <p
                    key={p}
                    className="mt-3 text-sm leading-loose text-muted-foreground sm:text-base"
                  >
                    {p}
                  </p>
                ))}
                {section.listIntro && (
                  <p className="mt-3 text-sm leading-loose text-muted-foreground sm:text-base">
                    {section.listIntro}
                  </p>
                )}
                {section.list && (
                  <ul className="mt-2 list-disc space-y-1.5 ps-6 text-sm leading-relaxed text-muted-foreground marker:text-primary sm:text-base">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {section.listOutro && (
                  <p className="mt-3 text-sm leading-loose text-muted-foreground sm:text-base">
                    {section.listOutro}
                  </p>
                )}
                {section.note && (
                  <p className="mt-4 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground">
                    <span className="font-bold">ملاحظة: </span>
                    {section.note}
                  </p>
                )}
              </li>
            ))}
          </ol>

          <p className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            حقوق النشر © {new Date().getFullYear()} {TEACHER}. جميع الحقوق
            محفوظة.
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
