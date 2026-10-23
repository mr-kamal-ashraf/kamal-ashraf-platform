"use client";

import { useParams } from "next/navigation";
import { StudentDetailView } from "@/features/admin/students/detail/StudentDetailView";

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  return <StudentDetailView studentId={params.id} />;
}
