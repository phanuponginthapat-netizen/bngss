import { Link } from "react-router-dom";

export function StudentLink({ id, code, name, className }: { id: string; code?: string; name: string; className?: string }) {
  return <Link to={`/dashboard/students?student_id=${id}`} className={`text-primary hover:underline ${className || ""}`} title={code || ""}>{name}</Link>;
}
export function ClassroomLink({ id, label }: { id: string; label: string }) {
  return <Link to={`/dashboard/classrooms?classroom_id=${id}`} className="text-primary hover:underline">{label}</Link>;
}
export function SubjectLink({ code, name }: { code: string; name?: string }) {
  return <Link to={`/dashboard/subjects?code=${code}`} className="text-primary hover:underline font-mono text-xs">{code}{name ? ` ${name}` : ""}</Link>;
}
