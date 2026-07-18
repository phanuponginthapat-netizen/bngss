import { Droplet, Sun, Camera, Thermometer, Zap, Lock, Wind, ShieldAlert, Activity, type LucideIcon } from "lucide-react";

export interface IoTCategory {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string; // tailwind text/bg color hint
  ring: string;
}

export const IOT_CATEGORIES: IoTCategory[] = [
  { value: "water",       label: "ระบบประปา",       icon: Droplet,      color: "text-cat-2",  ring: "border-cat-2/30 bg-cat-2-soft" },
  { value: "solar",       label: "โซลาร์เซลล์",     icon: Sun,          color: "text-cat-4",  ring: "border-cat-4/30 bg-cat-4-soft" },
  { value: "cctv",        label: "กล้องวงจรปิด",    icon: Camera,       color: "text-cat-8",  ring: "border-cat-8/30 bg-cat-8-soft" },
  { value: "energy",      label: "พลังงาน/มิเตอร์", icon: Zap,          color: "text-cat-5",  ring: "border-cat-5/30 bg-cat-5-soft" },
  { value: "environment", label: "สภาพแวดล้อม",     icon: Thermometer,  color: "text-cat-3",  ring: "border-cat-3/30 bg-cat-3-soft" },
  { value: "hvac",        label: "แอร์/ระบายอากาศ", icon: Wind,         color: "text-info",   ring: "border-info/30 bg-info-soft" },
  { value: "security",    label: "ความปลอดภัย",     icon: ShieldAlert,  color: "text-cat-1",  ring: "border-cat-1/30 bg-cat-1-soft" },
  { value: "access",      label: "ควบคุมการเข้า",   icon: Lock,         color: "text-cat-8",  ring: "border-cat-8/30 bg-cat-8-soft" },
  { value: "other",       label: "อื่นๆ",            icon: Activity,     color: "text-muted-foreground", ring: "border-border bg-muted/30" },
];

export const getCategory = (v?: string | null) =>
  IOT_CATEGORIES.find((c) => c.value === v) ?? IOT_CATEGORIES[IOT_CATEGORIES.length - 1];
