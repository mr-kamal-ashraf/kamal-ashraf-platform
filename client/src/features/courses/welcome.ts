/** The query flag that greets a student on a course they just opened. */
export const WELCOME_PARAM = "welcome";

/** The course page with the welcome popup — after paying, a code, or a free course. */
export const welcomeHref = (slug: string) =>
  `/courses/${slug}?${WELCOME_PARAM}=1`;
