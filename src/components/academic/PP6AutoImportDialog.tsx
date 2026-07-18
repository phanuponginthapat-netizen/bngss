import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { AutoImportDialogBase, MetaField } from "./AutoImportDialogBase";
import { useMyTeacherAssignments } from "@/hooks/useMyTeacherAssignments";
import { BE_OFFSET } from "@/lib/dateBE";

interface Props { onImportSuccess?: () => void; }

interface Classroom { id: string; name: string; gradeLevel: string; }
interface PP6Meta {
  classroomId?: string;
  autoMatched?: boolean;
  classrooms: Classroom[];
}

export default function PP6AutoImportDialog({ onImportSuccess }: Props) {
  const { data: assignments = [] } = useMyTeacherAssignments();
  const classrooms = useMemo<Classroom[]>(() => {
    const map = new Map<string, Classroom>();
    for (const a of assignments) {
      if (!map.has(a.classroom_id)) {
        map.set(a.classroom_id, { id: a.classroom_id, name: a.classroomName, gradeLevel: a.gradeLevel });
      }
    }
    return Array.from(map.values());
  }, [assignments]);

  return (
    <AutoImportDialogBase<PP6Meta>
      triggerLabel="นำเข้า ปพ.6 (อ่านอัตโนมัติ)"
      dialogTitle="นำเข้าไฟล์ ปพ.6 — อ่านทุก sheet อัตโนมัติ"
      dropHint="ระบบจะสแกนทุก sheet หาตารางนักเรียนพร้อมคะแนน/เกรดทุกวิชาให้อัตโนมัติ"
      tableName="pp6_files"
      bucket="pp6-files"
      initialMeta={{ classrooms }}
      onImportSuccess={onImportSuccess}
      onParsed={(parsed) => {
        const gl = (parsed.meta.gradeLevel || "").toLowerCase().replace(/\s+/g, "");
        const best = classrooms.find((c) => c.gradeLevel.toLowerCase().replace(/\s+/g, "") === gl);
        return { classrooms, classroomId: best?.id, autoMatched: !!best };
      }}
      resolveTarget={(it) => {
        const meta = it.parsed!.meta;
        const chosen = it.meta.classrooms.find((c) => c.id === it.meta.classroomId);
        const gradeLevel = chosen?.gradeLevel || meta.gradeLevel || "ไม่ระบุ";
        const classroomName = chosen?.name || (meta as any).classroomName || meta.gradeLevel || "";
        const year = meta.academicYear || new Date().getFullYear() + BE_OFFSET;
        const semester = meta.semester || 1;
        return {
          gradeLevel, year, semester,
          dedupWhere: { classroom_name: classroomName },
          insertExtra: { classroom_name: classroomName },
          parsedExtra: {
            classroom_id: chosen?.id || null,
            meta: { ...meta, gradeLevel, classroomName },
          },
        };
      }}
      renderMeta={(it, update) => {
        const list = it.meta.classrooms;
        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetaField label="โรงเรียน" value={it.parsed!.meta.schoolName} />
              <MetaField label="ระดับชั้น (ในไฟล์)" value={it.parsed!.meta.gradeLevel} />
              <MetaField label="ภาคเรียน" value={it.parsed!.meta.semester ? String(it.parsed!.meta.semester) : undefined} />
              <MetaField label="ปีการศึกษา" value={it.parsed!.meta.academicYear ? String(it.parsed!.meta.academicYear) : undefined} />
              <MetaField label="ครูประจำชั้น" value={it.parsed!.meta.teacherName} />
            </div>
            {list.length > 0 && (
              <div className="rounded-md border bg-muted/40 p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-muted-foreground">จับคู่กับห้องเรียนที่ครูรับผิดชอบ</label>
                  {it.meta.autoMatched && it.meta.classroomId && <Badge variant="secondary" className="text-[10px]">จับคู่อัตโนมัติ</Badge>}
                  {!it.meta.classroomId && (
                    <Badge variant="destructive" className="text-[10px] gap-1">
                      <AlertTriangle className="w-3 h-3" /> ยังไม่ได้เลือกห้อง
                    </Badge>
                  )}
                </div>
                <Select
                  value={it.meta.classroomId || ""}
                  onValueChange={(v) => update({ meta: { ...it.meta, classroomId: v, autoMatched: false } })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="เลือกห้องเรียน" /></SelectTrigger>
                  <SelectContent>
                    {list.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.gradeLevel} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <th className="text-left p-1">วิชา (ตัวอย่าง)</th>
              <th className="text-right p-1">คะแนน</th>
              <th className="text-center p-1">เกรด</th>
            </tr>
          </thead>
          <tbody>
            {parsed.consolidated.map((c) => {
              const entries = Object.entries(c.perSubject);
              const [subjName, v] = (entries[0] || ["-", {}]) as any;
              return (
                <tr key={c.studentCode} className="border-t">
                  <td className="p-1">{c.studentCode}</td>
                  <td className="p-1 truncate max-w-[120px]">{c.studentName}</td>
                  <td className="p-1 truncate max-w-[100px]">{subjName}</td>
                  <td className="p-1 text-right">{v?.totalScore ?? "-"}</td>
                  <td className="p-1 text-center font-medium">{v?.grade ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    />
  );
}
