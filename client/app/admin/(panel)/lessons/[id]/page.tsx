"use client";

import { useParams } from "next/navigation";
import { EditLessonView } from "@/features/admin/lessons/edit/EditLessonView";

export default function EditLessonPage() {
  const params = useParams<{ id: string }>();
  return <EditLessonView lessonId={params.id} />;
}
