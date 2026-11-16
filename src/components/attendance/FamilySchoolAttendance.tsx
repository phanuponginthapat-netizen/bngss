import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParentChildren } from '@/hooks/useParentChildren';
import { useUserRole } from '@/hooks/useUserRole';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { fetchAllRows } from '@/lib/fetchAllRows';
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
    queryFn: () => fetchAllRows((from, to) => {
      let q = supabase.from('attendance').select('id,student_id,attendance_date,status,notes').in('student_id', peopleIds)
        .is('subject_id', null).eq('period', 0).eq('academic_year', academicYear - 543).order('attendance_date', { ascending: false }).order('id').range(from, to);
      if (semester > 0) q = q.eq('semester', semester);
      if (date) q = q.eq('attendance_date', date);
      return q;
    }),
  });
  const labels: Record<string, string> = { present: 'มาโรงเรียน', absent: 'ขาด', late: 'สาย', leave: 'ลา', sick: 'ป่วย' };
  return <section className="space-y-4"><Input type="date" aria-label="วันที่มาโรงเรียน" className="w-full sm:w-52" value={date} onChange={e => setDate(e.target.value)} />
    {query.error || family.error || self.error ? <div role="alert" className="text-destructive">อ่านข้อมูลการมาโรงเรียนไม่สำเร็จ <Button variant="outline" onClick={() => { void family.refetch(); void self.refetch(); void query.refetch(); }}>ลองใหม่</Button></div> : peopleLoading || !calendar.isReady || query.isLoading ? <p>กำลังโหลด…</p> : !query.data?.length ? <p className="text-muted-foreground">ยังไม่มีบันทึกการมาโรงเรียนในวันที่เลือก</p> : <div className="divide-y divide-border">{query.data.map(row => { const person = people.find(c => c.id === row.student_id); return <div key={row.id} className="flex justify-between gap-3 py-3"><div><p>{person?.first_name} {person?.last_name}</p><p className="text-sm text-muted-foreground">{row.attendance_date}</p></div><span>{labels[row.status] ?? row.status}</span></div>; })}</div>}
  </section>;
}