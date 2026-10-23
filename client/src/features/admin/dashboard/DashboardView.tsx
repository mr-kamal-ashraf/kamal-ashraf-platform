"use client";

import { LoadingScreen } from "@/shared/ui/LoadingScreen";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { DashboardProvider, useDashboard } from "./DashboardProvider";
import { DashboardHeader } from "./sections/DashboardHeader";
import { LessonsStatsGrid } from "./sections/LessonsStatsGrid";
import { RefundAlertsBanner } from "./sections/RefundAlertsBanner";
import { StagesDistribution } from "./sections/StagesDistribution";
import { SalesStatsGrid } from "./sections/SalesStatsGrid";
import { StudentsStatsGrid } from "./sections/StudentsStatsGrid";

function DashboardContent() {
  const { isLoading, error, stats } = useDashboard();

  if (isLoading) return <LoadingScreen variant="page" />;
  if (error) return <ErrorBox message={error} />;
  if (!stats) return null;

  return (
    <div className="space-y-6 sm:space-y-8">
      <DashboardHeader />
      <RefundAlertsBanner />
      <StudentsStatsGrid />
      <SalesStatsGrid />
      <LessonsStatsGrid />
      <StagesDistribution />
    </div>
  );
}

export function DashboardView() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
