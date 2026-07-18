import { Droplet, Sun, Camera, Thermometer, Zap, Lock, Wind, ShieldAlert, Activity, type LucideIcon } from "lucide-react";

export interface IoTCategory {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string; // tailwind text/bg color hint
  ring: string;
}

export const IOT_CATEGORIES: IoTCategory[] = [
  { value: "water",       label: "ระบบประปา",       icon: Droplet,      color: "text-sky-500",     ring: "border-sky-500/30 bg-sky-500/5" },
  { value: "solar",       label: "โซลาร์เซลล์",     icon: Sun,          color: "text-amber-500",   ring: "border-amber-500/30 bg-amber-500/5" },
  { value: "cctv",        label: "กล้องวงจรปิด",    icon: Camera,       color: "text-violet-500",  ring: "border-violet-500/30 bg-violet-500/5" },
  { value: "energy",      label: "พลังงาน/มิเตอร์", icon: Zap,          color: "text-yellow-500",  ring: "border-yellow-500/30 bg-yellow-500/5" },
  { value: "environment", label: "สภาพแวดล้อม",     icon: Thermometer,  color: "text-emerald-500", ring: "border-emerald-500/30 bg-emerald-500/5" },
  { value: "hvac",        label: "แอร์/ระบายอากาศ", icon: Wind,         color: "text-cyan-500",    ring: "border-cyan-500/30 bg-cyan-500/5" },
  { value: "security",    label: "ความปลอดภัย",     icon: ShieldAlert,  color: "text-rose-500",    ring: "border-rose-500/30 bg-rose-500/5" },
  { value: "access",      label: "ควบคุมการเข้า",   icon: Lock,         color: "text-indigo-500",  ring: "border-indigo-500/30 bg-indigo-500/5" },
  { value: "other",       label: "อื่นๆ",            icon: Activity,     color: "text-muted-foreground", ring: "border-border bg-muted/30" },
];

export const getCategory = (v?: string | null) =>
  IOT_CATEGORIES.find((c) => c.value === v) ?? IOT_CATEGORIES[IOT_CATEGORIES.length - 1];
