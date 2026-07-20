/**
 * Persistent application settings (backend URL, theme mode).
 * Stored in localStorage; read on mount; updated reactively.
 */
import { useCallback, useState } from "react";
import type { AppSettings } from "@/types";

const STORAGE_KEY = "qrp_app_settings";

const DEFAULTS: AppSettings = {
  backendUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
  themeMode: "dark",
};

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function useAppSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(readSettings);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
