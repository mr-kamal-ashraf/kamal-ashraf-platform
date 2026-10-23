"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Local editable copy of one settings section. Re-syncs when the saved value
 * changes (after a save / reset) and reports whether there are unsaved edits.
 * While there are, closing or reloading the tab asks the browser to confirm.
 */
export function useDraft<T>(saved: T) {
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState<T>(saved);

  useEffect(() => {
    setDraft(JSON.parse(savedKey) as T);
  }, [savedKey]);

  const dirty = useMemo(() => JSON.stringify(draft) !== savedKey, [draft, savedKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return { draft, setDraft, dirty };
}
