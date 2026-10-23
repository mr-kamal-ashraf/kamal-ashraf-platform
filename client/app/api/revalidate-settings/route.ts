import { revalidatePath, revalidateTag } from "next/cache";
import { SITE_SETTINGS_TAG } from "@/shared/site-settings/server";

/**
 * Called by the admin panel right after the teacher saves appearance settings,
 * so the website picks the change up immediately instead of after the 60s
 * cache window. It only drops cached data (the next render refetches the
 * public settings), so it needs no secret.
 */
export async function POST() {
  revalidateTag(SITE_SETTINGS_TAG);
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
