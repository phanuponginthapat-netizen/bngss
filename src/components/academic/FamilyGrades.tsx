import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useParentChildren } from '@/hooks/useParentChildren';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { familyGradeSemester, linkedChild } from '@/lib/familyGrades';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function FamilyGrades() {
  const { userId, isParent, isStudent, loading: roleLoading } = useUserRole();
  const family = useParentChildren();
  const calendar = useAcademicYear();
  const [childId, setChildId] = useState('');
  const child = linkedChild(family.children, childId);
  const [year, setYear] = useState<number | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const effectiveYear = year ?? calendar.currentAcademicYear;
  const effectiveSemester = semester ?? familyGradeSemester(isParent || isStudent, calendar.currentSemester);
  const identity = useQuery({
    queryKey: ['family-grade-student', userId, isParent, child?.id],
    enabled: !!userId && !roleLoading && (!isParent || !family.isLoading),
    queryFn: async () => {
      if (isParent) return child;
      const { data, error } = await supabase.from('students').select('id,student_code,first_name,last_name').eq('auth_user_id', userId ?? '').maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const scores = useQuery({
    queryKey: ['family-grades', identity.data?.student_code, effectiveYear, effectiveSemester],
    enabled: !!identity.data?.student_code && calendar.isReady && !roleLoading,
    queryFn: () => fetchAllRows((from, to) => supabase.from('student_scores').select('id,total_score,grade,subjects(code,name_th)')
      .eq('student_code', identity.data?.student_code ?? '').eq('academic_year', effectiveYear - 543).eq('semester', effectiveSemester).order('id').range(from, to)),
  });
  const error = family.error || calendar.error || identity.error || scores.error;
  return <section className="space-y-4">
    <h1 className="text-2xl font-bold">{isParent ? 'ผลการเรียนของลูก' : 'ผลการเรียนของฉัน'}</h1>
    <div className="flex flex-wrap gap-3">
      {isParent && family.children.length > 0 && <Select value={child?.id ?? ''} onValueChange={setChildId}><SelectTrigger className="w-full sm:w-64" aria-label="เลือกบุตร"><SelectValue /></SelectTrigger><SelectContent>{family.children.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.student_code}</SelectItem>)}</SelectContent></Select>}
      <Select value={String(effectiveYear)} onValueChange={v => setYear(Number(v))}><SelectTrigger className="w-36" aria-label="ปีการศึกษา"><SelectValue /></SelectTrigger><SelectContent>{calendar.academicYearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
      <Select value={String(effectiveSemester)} onValueChange={v => setSemester(Number(v))}><SelectTrigger className="w-36" aria-label="ภาคเรียน"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">เทอม 1</SelectItem><SelectItem value="2">เทอม 2</SelectItem></SelectContent></Select>
    </div>
    {error ? <div role="alert" className="text-destructive">อ่านผลการเรียนไม่สำเร็จ <Button variant="outline" onClick={() => { void family.refetch(); void identity.refetch(); void scores.refetch(); }}>ลองใหม่</Button></div> : roleLoading || family.isLoading || !calendar.isReady || identity.isLoading || scores.isLoading ? <p>กำลังโหลด…</p> : !identity.data ? <p>ยังไม่มีข้อมูลนักเรียนที่เชื่อมกับบัญชีนี้</p> : !scores.data?.length ? <p className="text-muted-foreground">ยังไม่มีคะแนนเทอม {effectiveSemester} ปี {effectiveYear}</p> : <div className="divide-y divide-border">{scores.data.map(row => <div key={row.id} className="flex items-start justify-between gap-4 py-4"><div className="min-w-0"><p className="font-medium break-words">{row.subjects?.name_th ?? 'รายวิชา'}</p><p className="text-sm text-muted-foreground">{row.subjects?.code ?? '—'}</p></div><div className="shrink-0 text-right">{!['ผ', 'มผ'].includes(row.grade ?? '') && <p>คะแนนรวม {row.total_score ?? '—'}</p>}<p className="font-semibold text-primary">เกรด {row.grade ?? '—'}</p></div></div>)}</div>}
  </section>;
}