import { supabase } from "@/integrations/supabase/client";
import { kioskMediaParts } from "@/lib/kioskMediaUrl";

export type ScanReference = { reference_id?: string | null; reference_type?: string | null; reference_table?: string | null };

export function notificationEvidenceReference(reference: ScanReference) {
  const table = reference.reference_type || reference.reference_table;
  if (!reference.reference_id) return null;
  if (table === "face_scan_log" || table === "face_scan_logs") return { table: "face_scan_logs" as const, id: reference.reference_id };
  if (table === "kiosk_agent_alerts") return { table: "kiosk_agent_alerts" as const, id: reference.reference_id };
  return null;
}

// Never reuse cross-user media caches. Both record reads and signing use the
// caller's session: server RLS decides which student and object may be read.
async function signEvidence(raw: unknown, bucket: string): Promise<string | null> {
  const parts = kioskMediaParts(raw, bucket);
  if (!parts) return null;
  const { data, error } = await supabase.storage.from(parts.bucket).createSignedUrl(parts.path, 300);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("ไม่สามารถอ่านภาพได้");
  return data.signedUrl;
}

export async function loadNotificationEvidence(reference: ScanReference) {
  const source = notificationEvidenceReference(reference);
  if (!source) return null;
  if (source.table === "kiosk_agent_alerts") {
    const { data, error } = await supabase.from("kiosk_agent_alerts").select("snapshot_url").eq("id", source.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("ไม่พบภาพที่บัญชีนี้มีสิทธิ์ดู");
    return { portrait: null, scan: await signEvidence(data.snapshot_url, "face-photos"), paired: false };
  }
  const { data, error } = await supabase.from("face_scan_logs")
    .select("captured_face_url,students!inner(photo_url)").eq("id", source.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("ไม่พบภาพที่บัญชีนี้มีสิทธิ์ดู");
  const student = Array.isArray(data.students) ? data.students[0] : data.students;
  const results = await Promise.allSettled([
    signEvidence(student?.photo_url, "profile-images"),
    signEvidence(data.captured_face_url, "face-photos"),
  ]);
  return {
    portrait: results[0].status === "fulfilled" ? results[0].value : null,
    scan: results[1].status === "fulfilled" ? results[1].value : null,
    paired: true,
    failed: results.some(result => result.status === "rejected"),
  };
}