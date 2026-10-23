import { redirect } from "next/navigation";

// The AI nav item just needs to land somewhere sensible when clicked at the
// group level; the chat is the primary experience so we default there.
export default function AdminAIIndexPage() {
  redirect("/admin/ai/chat");
}
