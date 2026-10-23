"use client";

import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import {
  StudentDetailProvider,
  useStudentDetail,
} from "./StudentDetailProvider";
import { StudentHeader } from "./sections/StudentHeader";
import { StudentResetPassword } from "./sections/StudentResetPassword";
import { StudentSessions } from "./sections/StudentSessions";
import { StudentCourses } from "./sections/StudentCourses";
import { StudentWatchHistory } from "./sections/StudentWatchHistory";
import { StudentDangerZone } from "./sections/StudentDangerZone";

function StudentDetailContent() {
  const { isLoading, error, data } = useStudentDetail();

  if (isLoading) return <LoadingScreen variant="page" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <StudentHeader />
      <StudentCourses />
      <StudentSessions />
      <StudentWatchHistory />
      <StudentResetPassword />
      <StudentDangerZone />
    </div>
  );
}

export function StudentDetailView({ studentId }: { studentId: string }) {
  return (
    <StudentDetailProvider studentId={studentId}>
      <StudentDetailContent />
    </StudentDetailProvider>
  );
}
