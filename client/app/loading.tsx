import { LoadingScreen } from "@/shared/ui/LoadingScreen";

/**
 * While a page is still on its way from the server. After a click the
 * loading screen is already up (NavigationLoader) and stays until this goes.
 */
export default function Loading() {
  return <LoadingScreen variant="page" delayed />;
}
