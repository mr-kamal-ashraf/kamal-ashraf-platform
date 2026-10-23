/*
 * The course welcome popup's texts are templates the teacher writes in the
 * admin panel: these tokens are replaced when the popup shows.
 */

/** Becomes the student's first name. */
export const WELCOME_NAME_TOKEN = "{الاسم}";
/** Becomes the course title. */
export const WELCOME_COURSE_TOKEN = "{الكورس}";

/** Said instead of a name we don't have ("مبروك يا بطل!"). */
const NAME_FALLBACK = "بطل";

/** A text with the student's name (and the course, when given) filled in. */
export function welcomeTitle(
  template: string,
  firstName?: string,
  courseTitle?: string,
): string {
  const named = template
    .split(WELCOME_NAME_TOKEN)
    .join(firstName?.trim() || NAME_FALLBACK);
  return courseTitle === undefined
    ? named
    : named.split(WELCOME_COURSE_TOKEN).join(courseTitle);
}

/**
 * The message cut around the course token, so the course title can be shown
 * in bold between the pieces: ["كورس «", "» بقى بتاعك."] for one token.
 * The name token is filled in too.
 */
export function welcomeMessageParts(
  template: string,
  firstName?: string,
): string[] {
  return welcomeTitle(template, firstName).split(WELCOME_COURSE_TOKEN);
}
