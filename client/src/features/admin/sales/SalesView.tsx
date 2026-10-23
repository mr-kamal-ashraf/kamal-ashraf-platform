"use client";

import { SalesProvider } from "./SalesProvider";
import { SalesFilters } from "./sections/SalesFilters";
import { SalesHeader } from "./sections/SalesHeader";
import { SalesPagination } from "./sections/SalesPagination";
import { SalesSummaryCards } from "./sections/SalesSummaryCards";
import { SalesTable } from "./sections/SalesTable";
import { RefundAlerts } from "./sections/RefundAlerts";

export function SalesView() {
  return (
    <SalesProvider>
      <div className="space-y-5 sm:space-y-6">
        <SalesHeader />
        <RefundAlerts />
        <SalesSummaryCards />
        <SalesFilters />
        <SalesTable />
        <SalesPagination />
      </div>
    </SalesProvider>
  );
}
