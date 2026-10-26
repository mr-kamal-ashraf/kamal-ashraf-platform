import { env } from "../../config/env";

/** How messages name the platform: "منصة <name>", or "منصتنا" when unset. */
export function platformName(): string {
  const name = env.PLATFORM_NAME?.trim();
  return name ? `منصة ${name}` : "منصتنا";
}
