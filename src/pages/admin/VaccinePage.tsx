import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Search, Syringe } from "lucide-react";
import { ScanSearchButton } from "@/components/student/ScanSearchButton";
import { useStudentFilter } from "@/components/student/StudentSearchFilter";
import { useUserRole } from "@/hooks/useUserRole";

// วัคซีนตามโปรแกรม สพฐ./กระทรวงสาธารณสุข
const OBEC_VACCINES = [
  { value: "BCG", label: "BCG (วัคซีนวัณโรค)", ages: "แรกเกิด" },
  { value: "HBV", label: "HBV (ตับอักเสบบี)", ages: "แรกเกิด, 1 เดือน, 6 เดือน" },
  { value: "DTP-HB", label: "DTP-HB (คอตีบ-บาดทะยัก-ไอกรน-ตับอักเสบบี)", ages: "2, 4, 6 เดือน" },
  { value: "OPV", label: "OPV (โปลิโอชนิดหยอด)", ages: "2, 4, 6 เดือน" },
  { value: "IPV", label: "IPV (โปลิโอชนิดฉีด)", ages: "4 เดือน" },
  { value: "MMR", label: "MMR (หัด-หัดเยอรมัน-คางทูม)", ages: "9-12 เดือน, 2.5 ปี" },
  { value: "JE", label: "JE (ไข้สมองอักเสบ)", ages: "1 ปี, 2.5 ปี" },
  { value: "DTP", label: "DTP (คอตีบ-บาดทะยัก-ไอกรน กระตุ้น)", ages: "1.5 ปี, 4 ปี" },
  { value: "dT", label: "dT (คอตีบ-บาดทะยัก กระตุ้น)", ages: "ป.6 (12 ปี)" },
  { value: "HPV", label: "HPV (มะเร็งปากมดลูก)", ages: "ป.5 หญิง" },
  { value: "COVID19", label: "COVID-19", ages: "ตามนโยบาย" },
  { value: "Influenza", label: "ไข้หวัดใหญ่", ages: "ตามนโยบาย" },
  { value: "other", label: "อื่นๆ", ages: "" },
];

const VaccinePage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { isAdmin, isDirector } = useUserRole();
  const canManage = isAdmin || isDirector;
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [vaccineName, setVaccineName] = useState("");
  const [customVaccine, setCustomVaccine] = useState("");
  const [dose, setDose] = useState("1");
  const [lot, setLot] = useState("");
  const [notes, setNotes] = useState("");
  const [filterVaccine, setFilterVaccine] = useState("all");

  const { data: students = [] } = useQuery({
    queryKey: ["students_with_class"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*, classrooms!students_classroom_id_fkey(name, grade_level)").eq("status", "active").order("student_code");
      return data || [];
    },
  });
  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("grade_level").order("name");
      return data || [];
    },
  });
  const { data: records = [] } = useQuery({
    queryKey: ["vaccine_records"],
    queryFn: async () => {
      const { data } = await supabase.from("vaccine_records").select("*, students(student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name, grade_level))").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filter = useStudentFilter(students, classrooms);

  const filteredRecords = useMemo(() => {
    let result = records;
    const studentIds = new Set(filter.filteredStudents.map((s: any) => s.id));
    if (filter.search || filter.gradeFilter !== "all" || filter.classroomFilter !== "all") {
      result = result.filter((r: any) => studentIds.has(r.student_id));
    }
    if (filterVaccine !== "all") {
      result = result.filter((r: any) => r.vaccine_name === filterVaccine || r.vaccine_name?.includes(filterVaccine));
    }
    return result;
  }, [records, filter.filteredStudents, filter.search, filter.gradeFilter, filter.classroomFilter, filterVaccine]);

  const stats = useMemo(() => {
    const vaccineCount: Record<string, number> = {};
    records.forEach((r: any) => {
      vaccineCount[r.vaccine_name] = (vaccineCount[r.vaccine_name] || 0) + 1;
    });
    return { total: records.length, uniqueStudents: new Set(records.map((r: any) => r.student_id)).size, vaccineCount };
  }, [records]);

  const handleAdd = async () => {
    const finalName = vaccineName === "other" ? customVaccine : (OBEC_VACCINES.find(v => v.value === vaccineName)?.label || vaccineName);
    if (!studentId || !finalName) return;
    const { error } = await supabase.from("vaccine_records").insert({
      student_id: studentId,
      vaccine_name: finalName,
      dose_number: parseInt(dose),
      lot_number: lot || null,
      notes: notes || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "บันทึกสำเร็จ" : "Saved");
    qc.invalidateQueries({ queryKey: ["vaccine_records"] });
    setOpen(false); setVaccineName(""); setCustomVaccine(""); setLot(""); setNotes(""); setStudentId("");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("vaccine_records").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "ลบสำเร็จ" : "Deleted");
    qc.invalidateQueries({ queryKey: ["vaccine_records"] });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-responsive-title font-bold text-foreground">{lang === "th" ? "บันทึกการฉีดวัคซีน" : "Vaccine Records"}</h1>
          <p className="text-responsive-subtitle text-muted-foreground">{lang === "th" ? "บันทึกวัคซีนตามโปรแกรมสร้างเสริมภูมิคุ้มกันโรค" : "National immunization program records"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          {canManage && (<DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "บันทึกวัคซีน" : "Add Vaccine"}</Button></DialogTrigger>)}
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{lang === "th" ? "บันทึกการฉีดวัคซีนนักเรียน" : "Record Vaccine"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Student search */}
              <div>
                <Label>{lang === "th" ? "ค้นหานักเรียน (รหัส/ชื่อ)" : "Search Student"}</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder={lang === "th" ? "พิมพ์รหัสหรือชื่อนักเรียน..." : "Type code or name..."}
                    value={filter.search}
                    onChange={e => {
                      filter.setSearch(e.target.value);
                      const v = e.target.value.trim();
                      const exact = filter.filteredStudents.find((s: any) => s.student_code === v);
                      if (exact) setStudentId(exact.id);
                    }}
                  />
                  <ScanSearchButton onScan={(code) => {
                    filter.setSearch(code);
                    const exact = filter.filteredStudents.find((s: any) => s.student_code === code);
                    if (exact) setStudentId(exact.id);
                  }} />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <Select value={filter.gradeFilter} onValueChange={v => { filter.setGradeFilter(v); filter.setClassroomFilter("all"); }}>
                    <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{lang === "th" ? "ทุกชั้น" : "All"}</SelectItem>
                      {filter.gradeOptions.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filter.classroomFilter} onValueChange={filter.setClassroomFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder={lang === "th" ? "ห้อง" : "Room"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
                      {filter.filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกนักเรียน" : "Select student"} /></SelectTrigger>
                  <SelectContent>
                    {filter.filteredStudents.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.student_code} - {s.prefix || ""}{s.first_name} {s.last_name}
                        {s.classrooms && <span className="text-muted-foreground"> ({s.classrooms.name})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vaccine selection */}
              <div>
                <Label>{lang === "th" ? "ชื่อวัคซีน (ตามโปรแกรม EPI)" : "Vaccine Name"}</Label>
                <Select value={vaccineName} onValueChange={setVaccineName}>
                  <SelectTrigger><SelectValue placeholder={lang === "th" ? "เลือกวัคซีน" : "Select vaccine"} /></SelectTrigger>
                  <SelectContent>
                    {OBEC_VACCINES.map(v => (
                      <SelectItem key={v.value} value={v.value}>
                        <div className="flex flex-col">
                          <span>{v.label}</span>
                          {v.ages && <span className="text-xs text-muted-foreground">อายุ: {v.ages}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {vaccineName === "other" && (
                  <Input className="mt-2" placeholder={lang === "th" ? "ระบุชื่อวัคซีน..." : "Vaccine name..."} value={customVaccine} onChange={e => setCustomVaccine(e.target.value)} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><Label>{lang === "th" ? "เข็มที่" : "Dose #"}</Label><Input type="number" value={dose} onChange={e => setDose(e.target.value)} min="1" /></div>
                <div><Label>{lang === "th" ? "Lot No." : "Lot No."}</Label><Input value={lot} onChange={e => setLot(e.target.value)} /></div>
              </div>

              <div>
                <Label>{lang === "th" ? "หมายเหตุ" : "Notes"}</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={lang === "th" ? "อาการข้างเคียง, หมายเหตุ..." : "Side effects, notes..."} />
              </div>

              <Button onClick={handleAdd} className="w-full">{lang === "th" ? "บันทึก" : "Save"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <Syringe className="w-5 h-5 mx-auto mb-1 text-primary" />
          <p className="text-xs text-muted-foreground">{lang === "th" ? "บันทึกทั้งหมด" : "Total Records"}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "นักเรียนที่ได้รับ" : "Students Vaccinated"}</p>
          <p className="text-xl sm:text-2xl font-bold text-accent">{stats.uniqueStudents}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-card col-span-2 sm:col-span-1"><CardContent className="p-3 sm:p-4 text-center">
          <p className="text-xs text-muted-foreground">{lang === "th" ? "ชนิดวัคซีน" : "Vaccine Types"}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{Object.keys(stats.vaccineCount).length}</p>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={lang === "th" ? "ค้นหาจากรหัสหรือชื่อ..." : "Search..."} value={filter.search} onChange={e => filter.setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filter.gradeFilter} onValueChange={v => { filter.setGradeFilter(v); filter.setClassroomFilter("all"); }}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder={lang === "th" ? "ระดับชั้น" : "Grade"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "th" ? "ทุกระดับชั้น" : "All"}</SelectItem>
                {filter.gradeOptions.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filter.classroomFilter} onValueChange={filter.setClassroomFilter}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder={lang === "th" ? "ห้องเรียน" : "Classroom"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "th" ? "ทุกห้อง" : "All"}</SelectItem>
                {filter.filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.grade_level} - {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterVaccine} onValueChange={setFilterVaccine}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder={lang === "th" ? "ชนิดวัคซีน" : "Vaccine"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "th" ? "ทุกชนิด" : "All"}</SelectItem>
                {OBEC_VACCINES.map(v => <SelectItem key={v.value} value={v.label}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{lang === "th" ? "วันที่" : "Date"}</TableHead>
            <TableHead>{lang === "th" ? "นักเรียน" : "Student"}</TableHead>
            <TableHead>{lang === "th" ? "วัคซีน" : "Vaccine"}</TableHead>
            <TableHead>{lang === "th" ? "เข็มที่" : "Dose"}</TableHead>
            <TableHead className="hidden sm:table-cell">Lot</TableHead>
            <TableHead className="hidden md:table-cell">{lang === "th" ? "หมายเหตุ" : "Notes"}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredRecords.map((r: any) => {
              const s = r.students;
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.date_administered}</TableCell>
                  <TableCell className="font-medium">
                    <div>{s ? `${s.student_code} ${s.prefix || ""}${s.first_name} ${s.last_name}` : "—"}</div>
                    {s?.classrooms?.name && <span className="text-xs text-muted-foreground">{s.classrooms.name}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{r.vaccine_name}</Badge>
                  </TableCell>
                  <TableCell>{r.dose_number}</TableCell>
                  <TableCell className="hidden sm:table-cell">{r.lot_number || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[150px] truncate">{r.notes || "—"}</TableCell>
                  <TableCell>{canManage && (<Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>)}</TableCell>
                </TableRow>
              );
            })}
            {filteredRecords.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{lang === "th" ? "ไม่มีข้อมูล" : "No data"}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default VaccinePage;
