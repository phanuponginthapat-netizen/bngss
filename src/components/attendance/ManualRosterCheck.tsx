import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle2, XCircle, Clock, Stethoscope, FileText, Save } from "lucide-react";
import type { AttendanceStatus } from "./ScanAttendanceFlow";

interface Props {
  students: any[];
  contextLabel: string;
  onSubmit: (statusMap: Record<string, AttendanceStatus>, notesMap: Record<string, string>) => Promise<void> | void;
}

const STATUSES: { key: AttendanceStatus; th: string; en: string; cls: string; icon: any }[] = [
  { key: "present", th: "มา", en: "Present", cls: "bg-success text-success-foreground border-success", icon: CheckCircle2 },
  { key: "absent", th: "ขาด", en: "Absent", cls: "bg-danger text-danger-foreground border-danger", icon: XCircle },
  { key: "late", th: "สาย", en: "Late", cls: "bg-warning text-warning-foreground border-warning", icon: Clock },
  { key: "sick", th: "ป่วย", en: "Sick", cls: "bg-warning text-warning-foreground border-warning", icon: Stethoscope },
  { key: "leave", th: "ลา", en: "Leave", cls: "bg-info text-info-foreground border-info", icon: FileText },
];

export function ManualRosterCheck({ students, contextLabel, onSubmit }: Props) {
  const { lang } = useLanguage();
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // default all to present whenever roster changes
  useEffect(() => {
    const init: Record<string, AttendanceStatus> = {};
    students.forEach((s: any) => { init[s.id] = "present"; });
    setMarks(init);
    setNotes({});
  }, [students]);

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, sick: 0, leave: 0 };
    Object.values(marks).forEach((v) => { c[v] = (c[v] || 0) + 1; });
    return c;
  }, [marks]);

  const setAll = (st: AttendanceStatus) => {
    const m: Record<string, AttendanceStatus> = {};
    students.forEach((s: any) => { m[s.id] = st; });
    setMarks(m);
  };

  const handleSave = async () => {
    setBusy(true);
    try { await onSubmit(marks, notes); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {/* Header bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b">
          <div className="text-sm font-medium">{contextLabel}</div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {STATUSES.map((s) => (
              <Badge key={s.key} variant="outline" className={`${s.cls} border-0`}>
                {lang === "th" ? s.th : s.en}: {counts[s.key] || 0}
              </Badge>
            ))}
          </div>
        </div>

        {/* Bulk actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setAll("present")} className="border-success/40 text-success dark:text-success">
            <CheckCircle2 className="w-4 h-4 mr-1" />{lang === "th" ? "มาทั้งหมด" : "All Present"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAll("absent")} className="border-danger/40 text-danger dark:text-danger">
            <XCircle className="w-4 h-4 mr-1" />{lang === "th" ? "ขาดทั้งหมด" : "All Absent"}
          </Button>
        </div>

        {/* Roster */}
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium bg-muted text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-2">{lang === "th" ? "รหัส" : "Code"}</div>
            <div className="col-span-3">{lang === "th" ? "ชื่อ-นามสกุล" : "Name"}</div>
            <div className="col-span-3">{lang === "th" ? "สถานะ" : "Status"}</div>
            <div className="col-span-3">{lang === "th" ? "หมายเหตุ" : "Notes"}</div>
          </div>
          <div className="divide-y">
            {students.map((s: any, idx: number) => {
              const cur = marks[s.id] || "present";
              return (
                <div key={s.id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-muted/30">
                  <div className="col-span-1 text-sm text-muted-foreground">{idx + 1}</div>
                  <div className="col-span-2 text-sm font-mono">{s.student_code}</div>
                  <div className="col-span-3 text-sm">{s.prefix}{s.first_name} {s.last_name}</div>
                  <div className="col-span-3 flex flex-wrap gap-1">
                    {STATUSES.map((st) => {
                      const Icon = st.icon;
                      const active = cur === st.key;
                      return (
                        <button
                          key={st.key}
                          onClick={() => setMarks((p) => ({ ...p, [s.id]: st.key }))}
                          className={`px-2 py-1 rounded-md text-xs font-medium border transition ${active ? st.cls : "bg-background hover:bg-muted border-border text-muted-foreground"}`}
                        >
                          <Icon className="w-3 h-3 inline mr-0.5" />
                          {lang === "th" ? st.th : st.en}
                        </button>
                      );
                    })}
                  </div>
                  <div className="col-span-3">
                    <Input
                      value={notes[s.id] || ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [s.id]: e.target.value }))}
                      placeholder={lang === "th" ? "หมายเหตุ" : "Notes"}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky save */}
        <div className="sticky bottom-2 flex justify-end pt-2">
          <Button onClick={handleSave} disabled={busy} size="lg" className="shadow-lg">
            <Save className="w-4 h-4 mr-2" />
            {busy
              ? (lang === "th" ? "กำลังบันทึก..." : "Saving...")
              : (lang === "th" ? `บันทึก ${students.length} คน` : `Save ${students.length}`)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
