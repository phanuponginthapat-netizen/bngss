import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { todayBangkok } from "@/lib/dateBE";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock } from "lucide-react";

interface LateRecord {
  student_id: string;
  first_name: string;
  last_name: string;
  prefix: string;
  late_minutes: number;
  classroom_name: string;
  scan_time: string;
}

export function LateTrackingWidget() {
  const { lang } = useLanguage();
  const [lateStudents, setLateStudents] = useState<LateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = todayBangkok();
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          student_id,
          late_minutes,
          scan_time,
          students!inner (
            first_name,
            last_name,
            prefix,
            classrooms!inner ( name )
          )
        `)
        .eq("status", "late")
        .eq("attendance_date", today)
        .order("late_minutes", { ascending: false });

      if (cancelled || error) return;

      const records: LateRecord[] = (data || []).map((r: any) => ({
        student_id: r.student_id,
        first_name: r.students.first_name,
        last_name: r.students.last_name,
        prefix: r.students.prefix || "",
        late_minutes: r.late_minutes,
        classroom_name: r.students.classrooms.name,
        scan_time: r.scan_time,
      }));

      setLateStudents(records);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          {lang === "th" ? "นักเรียนสายวันนี้" : "Late Students Today"}
          <Badge variant="secondary" className="ml-auto">
            {lateStudents.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {lateStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {lang === "th" ? "ไม่มีนักเรียนสายวันนี้" : "No late students today"}
          </p>
        ) : (
          <div className="space-y-2">
            {lateStudents.map((s) => (
              <div key={s.student_id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-orange-100 text-orange-700">
                    {s.first_name?.[0]}{s.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.prefix}{s.first_name} {s.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.classroom_name}</div>
                </div>
                <Badge variant={s.late_minutes > 15 ? "destructive" : "outline"} className="shrink-0">
                  {s.late_minutes} {lang === "th" ? "นาที" : "min"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
