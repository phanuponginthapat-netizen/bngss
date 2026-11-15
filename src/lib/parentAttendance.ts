import { resolveDigestStatuses } from "../../supabase/functions/_shared/attendanceDigest";
export function parentAttendanceStatus(studentId: string, attendance: {status:string|null}[], scans: {scan_time:string|null;scan_type:string|null;created_at?:string|null}[], threshold: string) {
  return resolveDigestStatuses(attendance.map(r=>({...r,student_id:studentId})),scans.map(r=>({...r,student_id:studentId,scan_type:r.scan_type||""})),threshold).get(studentId) || null;
}