"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SettingsMessage = { type: "success" | "error"; text: string };

export interface SettingsSectionState {
  loading: boolean;
  saving: boolean;
  message: SettingsMessage | null;
  /** Fetches GET /admin/api/settings. Returns the settings map, or null when the read fails. */
  load: () => Promise<Record<string, unknown> | null>;
  /** PUTs the given patch; on success clears dirty, reports clean to the parent, and sets a success message. */
  save: (patch: Record<string, unknown>) => Promise<boolean>;
  /** Shows an error that persists until the next action; cancels any pending success auto-clear. */
  fail: (text: string) => void;
  /** Clears dirty + notifies the parent registry (used after Discard restores the snapshot). */
  markSaved: () => void;
  /** Syncs this section's dirty flag up to the page-level leave guard. */
  reportDirty: (dirty: boolean) => void;
}

const SUCCESS_MESSAGE_MS = 3000;

export function useSettingsSection(
  onDirtyChange?: (dirty: boolean) => void
): SettingsSectionState {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);

  const onDirtyChangeRef = useRef(onDirtyChange);
  const loadedRef = useRef(false);
  const lastReportedDirtyRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  });

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  const reportDirty = useCallback((dirty: boolean) => {
    if (dirty === lastReportedDirtyRef.current) return;
    lastReportedDirtyRef.current = dirty;
    onDirtyChangeRef.current?.(dirty);
  }, []);

  // A card unmounts only on tab switch, so withdraw its dirty claim when it leaves
  // (the leave-guard already confirmed, so the changes are intentionally discarded).
  useEffect(() => {
    return () => {
      clearSuccessTimer();
      if (lastReportedDirtyRef.current) {
        lastReportedDirtyRef.current = false;
        onDirtyChangeRef.current?.(false);
      }
    };
  }, [clearSuccessTimer]);

  const load = useCallback(async () => {
    if (!loadedRef.current) setLoading(true);
    try {
      const res = await fetch("/admin/api/settings");
      if (!res.ok) return null;
      const data = (await res.json()) as { settings: Record<string, unknown> };
      loadedRef.current = true;
      return data.settings ?? null;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const markSaved = useCallback(() => {
    reportDirty(false);
  }, [reportDirty]);

  const save = useCallback(
    async (patch: Record<string, unknown>): Promise<boolean> => {
      clearSuccessTimer();
      setSaving(true);
      setMessage(null);
      try {
        const res = await fetch("/admin/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await res.json()) as { error?: string };
        if (res.ok) {
          setMessage({ type: "success", text: "Saved." });
          successTimerRef.current = setTimeout(() => setMessage(null), SUCCESS_MESSAGE_MS);
          markSaved();
          return true;
        }
        setMessage({ type: "error", text: data.error ?? "Failed to save." });
        return false;
      } catch {
        setMessage({ type: "error", text: "Network error. Please try again." });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [clearSuccessTimer, markSaved]
  );

  const fail = useCallback(
    (text: string) => {
      clearSuccessTimer();
      setMessage({ type: "error", text });
    },
    [clearSuccessTimer]
  );

  return { loading, saving, message, load, save, fail, markSaved, reportDirty };
}
