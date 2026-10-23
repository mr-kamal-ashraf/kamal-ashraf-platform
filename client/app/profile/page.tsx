import type { Metadata } from "next";
import { ProfileView } from "@/features/profile/ProfileView";

export const metadata: Metadata = {
  title: "حسابي",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfileView />;
}
