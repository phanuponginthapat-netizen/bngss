import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { AutoImportDialogBase, MetaField } from "./AutoImportDialogBase";
import { useMyTeacherAssignments, pickBestAssignment, type MyTeacherAssignment } from "@/hooks/useMyTeacherAssignments";
import { BE_OFFSET } from "@/lib/dateBE";

interface Props { onImportSuccess?: () => void; }

interface PP5Meta {
  assignmentId?: string;
  autoMatched?: boolean;
  assignments: MyTeacherAssignment[];
}

export default function PP5AutoImportDialog({ onImportSuccess }: Props) {
  const { data: assignments = [] } = useMyTeacherAssignments();
  const initialMeta: PP5Meta = { assignments };

  return (
    <AutoImportDialogBase<PP5Meta>
      triggerLabel="นำเข้า ปพ.5 (อ่านอัตโนมัติ)"
      dialogTitle="นำเข้าไฟล์ ปพ.5 — อ่านทุก sheet อัตโนมัติ"
      dropHint="ระบบจะสแกนทุก sheet หาตารางนักเรียน (เลขประจำตัว + ชื่อ) แล้วดึงคะแนนทั้งหมด"
      tableName="pp5_files"
      bucket="pp5-files"
      initialMeta={initialMeta}
      onImportSuccess={onImportSuccess}
      onParsed={(parsed) => {
        const best = pickBestAssignment(assignments, parsed.meta);
        return { assignments, assignmentId: best?.id, autoMatched: !!best };
      }}
      resolveTarget={(it) => {
        const meta = it.parsed!.meta;
        const chosen = it.meta.assignments.find((a) => a.id === it.meta.assignmentId);
        const gradeLevel = chosen?.gradeLevel || meta.gradeLevel || "ไม่ระบุ";
        const subjectName = chosen?.subjectName || meta.subjectName || it.file.name.replace(/\.[^.]+$/, "");
        const subjectCode = chosen?.subjectCode || meta.subjectCode || null;
        const year = meta.academicYear || new Date().getFullYear() + BE_OFFSET;
        const semester = meta.semester || 1;
        return {
          gradeLevel, year, semester,
          dedupWhere: { subject_name: subjectName },
          insertExtra: { subject_name: subjectName, subject_code: subjectCode },
          parsedExtra: {
            teacher_assignment_id: chosen?.id || null,
            classroom_id: chosen?.classroom_id || null,
            subject_id: chosen?.subject_id || null,
            meta: { ...meta, subjectName, subjectCode: subjectCode || undefined, gradeLevel },
          },
        };
      }}
      renderMeta={(it, update) => {
        const list = it.meta.assignments;
        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetaField label="โรงเรียน" value={it.parsed!.meta.schoolName} />
              <MetaField label="ระดับชั้น" value={it.parsed!.meta.gradeLevel} />
              <MetaField label="ภาคเรียน" value={it.parsed!.meta.semester ? String(it.parsed!.meta.semester) : undefined} />
              <MetaField label="ปีการศึกษา" value={it.parsed!.meta.academicYear ? String(it.parsed!.meta.academicYear) : undefined} />
              <MetaField label="วิชา (ในไฟล์)" value={it.parsed!.meta.subjectName} />
              <MetaField label="ครูผู้สอน" value={it.parsed!.meta.teacherName} />
            </div>
            {list.length > 0 ? (
              <div className="rounded-md border bg-muted/40 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground">จับคู่กับรายวิชาที่ครูรับผิดชอบ</label>
                  {it.meta.autoMatched && it.meta.assignmentId && <Badge variant="secondary" className="text-[10px]">จับคู่อัตโนมัติ</Badge>}
                  {!it.meta.assignmentId && (
                    <Badge variant="destructive" className="text-[10px] gap-1">
                      <AlertTriangle className="w-3 h-3" /> ยังไม่ได้เลือกวิชา
                    </Badge>
                  )}
                </div>
                <Select
                  value={it.meta.assignmentId || ""}
                  onValueChange={(v) => update({ meta: { ...it.meta, assignmentId: v, autoMatched: false } })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="เลือกวิชา + ชั้นเรียน" /></SelectTrigger>
                  <SelectContent>
                    {list.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.subjectCode ? `[${a.subjectCode}] ` : ""}{a.subjectName} — {a.classroomName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">* ยังไม่มีการมอบหมายวิชาให้ครูผู้ใช้งาน — ระบบจะใช้ข้อมูลจากไฟล์แทน</p>
            )}
          </>
        );
      }}
      renderPreviewTable={(parsed) => (
        <table className="w-full text-[11px]">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="text-left p-1">รหัส</th>
              <th className="text-left p-1">ชื่อ</th>
              <th className="text-right p-1">คะแนนรวม</th>
              <th className="text-center p-1">เกรด</th>
              <th className="text-center p-1">คุณลักษณะ</th>
              <th className="text-center p-1">สมรรถนะ</th>
              <th className="text-center p-1">อ่านคิด</th>
            </tr>
          </thead>
          <tbody>
            {parsed.consolidated.map((c) => {
              const first = Object.values(c.perSubject)[0] as any;
              return (
                <tr key={c.studentCode} className="border-t">
                  <td className="p-1">{c.studentCode}</td>
                  <td className="p-1 truncate max-w-[140px]">{c.studentName}</td>
                  <td className="p-1 text-right">{first?.totalScore ?? "-"}</td>
                  <td className="p-1 text-center font-medium">{first?.grade ?? "-"}</td>
                  <td className="p-1 text-center">{first?.characterLevel ?? "-"}</td>
                  <td className="p-1 text-center">{first?.competencyLevel ?? "-"}</td>
                  <td className="p-1 text-center">{first?.readingLevel ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    />
  );
}
