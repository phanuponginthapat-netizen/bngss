import { supabase } from "@/integrations/supabase/client";
import type { PdfTemplateRecord } from "./types";

export interface SubmitResult {
  submission_id: string;
  synced_refs: Record<string, string>;
}

/**
 * Submit a public form filling.
 * - Insert into form_submissions (anon-allowed if template.is_public)
 * - Optionally sync into home_visits / student_subsidies based on template.sync_targets
 */
export async function submitPublicForm(opts: {
  template: PdfTemplateRecord & { sync_targets?: Record<string, boolean> };
  student_id: string | null;
  school_id: string | null;
  submitter_name?: string;
  submitter_contact?: string;
  values: Record<string, any>;   // resolved data shape (school/student/visit/...)
}): Promise<SubmitResult> {
  const { template, student_id, school_id, submitter_name, submitter_contact, values } = opts;

  const { data: ins, error } = await supabase
    .from("form_submissions" as any)
    .insert({
      template_id: template.id,
      student_id,
      school_id,
      submitter_name: submitter_name || values?.user?.full_name || null,
      submitter_contact: submitter_contact || null,
      data: values,
      status: "submitted",
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  const submission_id = (ins as any)?.id as string;

  const synced_refs: Record<string, string> = {};
  const targets = template.sync_targets || {};

  // Home visit sync
  if (targets.home_visit && student_id) {
    const v = values.visit || {};
    const visitDate = parseIsoDate(v.date) || new Date().toISOString().slice(0, 10);
    const { data: hv } = await supabase
      .from("home_visits")
      .insert({
        student_id,
        visit_date: visitDate,
        visitor_name: values.teacher?.name || submitter_name || "ผู้กรอกฟอร์ม",
        home_condition: v.notes || null,
        family_status: v.economic || null,
        income_per_month: toNumber(v.income_per_month),
        recommendations: v.recommendations || null,
        school_id,
      })
      .select("id")
      .maybeSingle();
    if ((hv as any)?.id) synced_refs.home_visit_id = (hv as any).id;
  }

  // Scholarship / subsidy sync
  if (targets.subsidy && student_id) {
    const sc = values.scholarship || {};
    const { data: sub } = await supabase
      .from("student_subsidies")
      .insert({
        student_id,
        subsidy_type: sc.name || "กสศ.",
        amount: toNumber(sc.amount) ?? 0,
        disbursement_date: parseIsoDate(sc.date),
        academic_year: toIntOrNull(values.academic?.year),
        semester: toIntOrNull(values.academic?.semester),
        income_per_month: toNumber(values.visit?.income_per_month),
        status: "pending",
        notes: `Auto from form ${template.name}`,
      })
      .select("id")
      .maybeSingle();
    if ((sub as any)?.id) synced_refs.student_subsidy_id = (sub as any).id;
  }

  if (Object.keys(synced_refs).length && submission_id) {
    await supabase.from("form_submissions" as any)
      .update({ status: "synced", synced_refs })
      .eq("id", submission_id);
  }

  return { submission_id, synced_refs };
}

function toNumber(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}
function toIntOrNull(v: any): number | null {
  const n = toNumber(v);
  return n == null ? null : Math.trunc(n);
}
function parseIsoDate(v: any): string | null {
  if (!v) return null;
  // accept already ISO; otherwise try Date()
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}
