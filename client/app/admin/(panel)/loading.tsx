import { LoadingScreen } from "@/shared/ui/LoadingScreen";

/**
 * Moving between admin pages — the same loading screen as the site. Kept at
 * this level (not left to app/loading.tsx) so the panel itself stays mounted
 * underneath and its sign-in check doesn't run again on every page.
 */
export default function AdminLoading() {
  return <LoadingScreen variant="page" delayed />;
}
