import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParentChildren } from '@/hooks/useParentChildren';
import { useUserRole } from '@/hooks/useUserRole';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { resolveKioskMediaUrl } from '@/lib/kioskMediaUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function FamilySchoolAttendance({ academicYear, semester }: { academicYear: number; semester: number }) {
  const family = useParentChildren();
  const { userId, isStudent, loading: roleLoading } = useUserRole();
  const calendar = useAcademicYear();
  const [date, setDate] = useState('');
  // นักเรียนดูบันทึกของตัวเอง ผู้ปกครองดูบันทึกของลูกที่เชื่อมบัญชี
  const self = useQuery({
    queryKey: ['family-school-self', userId],
    enabled: !!userId && isStudent && !roleLoading,
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('id,first_name,last_name').eq('auth_user_id', userId ?? '').maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const people = isStudent ? (self.data ? [self.data] : []) : family.children;
  const peopleIds = people.map(p => p.id);
  const peopleLoading = isStudent ? (roleLoading || self.isLoading) : family.isLoading;
  const query = useQuery({
    queryKey: ['family-school-attendance', peopleIds.join(','), academicYear, semester, date],
    enabled: !peopleLoading && calendar.isReady && peopleIds.length > 0,
    queryFn: async () => {
      const rows = await fetchAllRows((from, to) => {
        let q = supabase.from('attendance').select('id,student_id,attendance_date,status,notes').in('student_id', peopleIds)
          .is('subject_id', null).eq('period', 0).eq('academic_year', academicYear - 543).order('attendance_date', { ascending: false }).order('id').range(from, to);
        if (semester > 0) q = q.eq('semester', semester);
        if (date) q = q.eq('attendance_date', date);
        return q;
      });
      // ดึงหลักฐานการสแกน (เวลา + รูป) ของวันที่มีบันทึก เลือกการสแกนเข้าครั้งแรกของแต่ละคนในแต่ละวัน
      const dates = [...new Set(rows.map(r => r.attendance_date))];
      const scans = new Map<string, { time: string; photo: string | null }>();
      if (dates.length > 0) {
        const { data: logs, error: scanError } = await supabase.from('face_scan_logs')
          .select('student_id,scan_date,scan_time,captured_face_url')
          .in('student_id', peopleIds).in('scan_date', dates).eq('scan_type', 'entry')
          .order('scan_time').limit(1000);
        if (scanError) throw scanError;
        for (const log of logs ?? []) {
          const key = `${log.student_id}:${log.scan_date}`;
          if (scans.has(key)) continue;
          scans.set(key, { time: String(log.scan_time).slice(0, 5), photo: await resolveKioskMediaUrl(log.captured_face_url) });
        }
      }
      return rows.map(r => ({ ...r, scan: scans.get(`${r.student_id}:${r.attendance_date}`) ?? null }));
    },
  });
  const labels: Record<string, string> = { present: 'มาโรงเรียน', absent: 'ขาด', late: 'สาย', leave: 'ลา', sick: 'ป่วย' };
  return <section className="space-y-4"><Input type="date" aria-label="วันที่มาโรงเรียน" className="w-full sm:w-52" value={date} onChange={e => setDate(e.target.value)} />
    {query.error || family.error || self.error ? <div role="alert" className="text-destructive">อ่านข้อมูลการมาโรงเรียนไม่สำเร็จ <Button variant="outline" onClick={() => { void family.refetch(); void self.refetch(); void query.refetch(); }}>ลองใหม่</Button></div> : peopleLoading || !calendar.isReady || query.isLoading ? <p>กำลังโหลด…</p> : !query.data?.length ? <p className="text-muted-foreground">ยังไม่มีบันทึกการมาโรงเรียนในวันที่เลือก</p> : <div className="divide-y divide-border">{query.data.map(row => { const person = people.find(c => c.id === row.student_id); return <div key={row.id} className="flex items-center justify-between gap-3 py-3"><div className="flex items-center gap-3 min-w-0">{row.scan?.photo ? <img src={row.scan.photo} alt="รูปตอนสแกน" className="h-12 w-12 shrink-0 rounded-full object-cover border border-border" loading="lazy" /> : null}<div className="min-w-0"><p className="truncate">{person?.first_name} {person?.last_name}</p><p className="text-sm text-muted-foreground">{row.attendance_date}{row.scan ? ` · ${row.scan.time} น.` : ''}</p></div></div><span className="shrink-0">{labels[row.status] ?? row.status}</span></div>; })}</div>}
  </section>;
}