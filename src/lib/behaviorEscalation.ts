// Behavior escalation — auto-notify for serious negative behaviors
import { supabase } from "@/integrations/supabase/client";

export const SERIOUS_BEHAVIORS = [
  "drug",      // ยาเสพติด
  "violence",  // ความรุนแรง
  "bullying",  // การกลั่นแกล้ง
  "sexual",    // พฤติกรรมทางเพศ
  "theft",     // ลักขโมย
];

export interface BehaviorEscalation {
  student_id: string;
  student_name: string;
  behavior_type: string;
  severity: "serious" | "moderate" | "minor";
  auto_actions: string[];
  notify_parent: boolean;
  notify_counselor: boolean;
}

export function checkEscalation(behaviorType: string, isPositive: boolean): BehaviorEscalation | null {
  if (isPositive) return null;

  const isSerious = SERIOUS_BEHAVIORS.includes(behaviorType);
  if (!isSerious) return null;

  return {
    student_id: "",
    student_name: "",
    behavior_type: behaviorType,
    severity: "serious",
    auto_actions: [
      "บันทึกในรายงานพฤติกรรมนักเรียน",
      "แจ้งผู้ปกครองทันที",
      "แจ้งหัวหน้างานกิจการนักเรียน",
      behaviorType === "drug" ? "รายงาน ผอ.โรงเรียน" : "",
      behaviorType === "violence" ? "ส่งต่อสหวิชาชีพ" : "",
    ].filter(Boolean),
    notify_parent: true,
    notify_counselor: true,
  };
}
