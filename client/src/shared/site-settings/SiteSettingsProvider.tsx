"use client";

import { createContext, useContext, type ReactNode } from "react";
import { resolveSiteSettings } from "./resolve";
import type { SiteSettings } from "./types";

const SiteSettingsContext = createContext<SiteSettings>(resolveSiteSettings(null));

/** Makes the server-loaded settings available to every client component. */
export function SiteSettingsProvider({
  value,
  children,
}: {
  value: SiteSettings;
  children: ReactNode;
}) {
  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext);
}
