import { useCallback, useEffect, useState } from "react";
import { useUserRole } from "./useUserRole";

const KEY = "view_mode_override";
type Override = "admin" | "teacher" | null;

const readOverride = (): Override => {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "teacher" || v === "admin" ? v : null;
};

/**
 * Thin wrapper for the view-mode toggle. Real override logic ตอนนี้อยู่ใน
 * useUserRole เพื่อให้ทุกส่วนของระบบ (sidebar/dashboard/permissions/queries)
 * ตอบสนองต่อการสลับโหมดทันทีโดยไม่ต้องแก้ทีละหน้า
 */
export function useViewMode() {
  const { role, realRole, isTeacherAdmin, loading } = useUserRole();
  const [override, setOverride] = useState<Override>(readOverride);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setOverride(readOverride());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((mode: "admin" | "teacher") => {
    window.localStorage.setItem(KEY, mode);
    setOverride(mode);
    // notify same-tab listeners (storage event only fires cross-tab)
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: mode }));
  }, []);

  const clear = useCallback(() => {
    window.localStorage.removeItem(KEY);
    setOverride(null);
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: null }));
  }, []);

  return {
    role: realRole,          // สิทธิ์จริง (ไว้เช็คใน switcher)
    effectiveRole: role,     // ที่ระบบใช้จริง
    isTeacherAdmin,
    viewMode: (isTeacherAdmin ? override ?? "admin" : "admin") as "admin" | "teacher",
    setMode,
    clear,
    loading,
  };
}
