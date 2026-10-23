"use client";

import { useParams } from "next/navigation";
import { EditCourseView } from "@/features/admin/courses/edit/EditCourseView";

export default function EditCoursePage() {
  const params = useParams<{ id: string }>();
  return <EditCourseView courseId={params.id} />;
}
