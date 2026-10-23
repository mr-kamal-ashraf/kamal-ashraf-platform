"use client";

import { EscalationsProvider } from "./EscalationsProvider";
import { EscalationsHeader } from "./sections/EscalationsHeader";
import { EscalationsList } from "./sections/EscalationsList";

export function EscalationsView() {
  return (
    <EscalationsProvider>
      <div className="space-y-5 sm:space-y-6">
        <EscalationsHeader />
        <EscalationsList />
      </div>
    </EscalationsProvider>
  );
}
