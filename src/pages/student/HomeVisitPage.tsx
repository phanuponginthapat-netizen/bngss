import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Camera, Upload, X, Eye, Printer, FileText } from "lucide-react";
import { openPrintWindow, currentThaiDate } from "@/lib/printUtils";
import { HomeVisitSummaryDialog } from "@/components/student/HomeVisitSummaryDialog";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import { useStudentData } from "@/hooks/useStudentData";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearFilter } from "@/components/AcademicYearFilter";
import { SignedImage } from "@/components/ui/SignedImage";
import { resolveStorageUrl } from "@/lib/storageUrl";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Kosor01FormSection } from "@/components/student/Kosor01FormSection";
import { renderKosor01Html } from "@/lib/kosor01";
import { BE_OFFSET } from "@/lib/dateBE";
import { notifyStudentEvent } from "@/lib/notifyStudentEvent";
import { saveErrorMessage, safeNum, safeInt } from "@/lib/saveError";
import { swal } from "@/lib/swal";

const HomeVisitPage = () => {
  const { lang } = useLanguage();
  const { user: authUser } = useAuthSession();
  const schoolInfo = useSchoolInfo();
  const qc = useQueryClient();
  const studentData = useStudentData();
  const { currentAcademicYear, currentSemester, academicYearOptions } = useAcademicYear();
  const [academicYear, setAcademicYear] = useState(0);
  const [semester, setSemester] = useState(0);
  if (academicYear === 0 && currentAcademicYear > 0) { setAcademicYear(currentAcademicYear); setSemester(currentSemester); }
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<any>(null);

  // Use studentData for filters
  const filterGrade = studentData.gradeFilter;
  const setFilterGrade = studentData.setGradeFilter;
  const filterClassroom = studentData.classroomFilter;
  const setFilterClassroom = studentData.setClassroomFilter;

  // Form state
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [studentId, setStudentId] = useState("");
  const [homeCondition, setHomeCondition] = useState("");
  const [studentCondition, setStudentCondition] = useState("");
  const [familyStatus, setFamilyStatus] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [povertyStatus, setPovertyStatus] = useState("ไม่ยากจน");
  const [incomePerMonth, setIncomePerMonth] = useState("");
  const [houseOwnership, setHouseOwnership] = useState("");
  const [livingWith, setLivingWith] = useState("");
  const [numFamilyMembers, setNumFamilyMembers] = useState("");
  const [hasInternet, setHasInternet] = useState(false);
  const [hasComputer, setHasComputer] = useState(false);
  const [travelMethod, setTravelMethod] = useState("");
  const [distanceToSchool, setDistanceToSchool] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [kosor01, setKosor01] = useState<Record<string, any>>({});

  // Auto-fill visitor from logged-in user profile
  const [visitorName, setVisitorName] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["my-profile", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
      return data;
    },
  });

  const classrooms = studentData.classrooms;

  // Students for form (filtered by selected classroom)
  const formStudents = useMemo(() => {
    const cid = selectedClassroom || filterClassroom;
    if (!cid || cid === "all") return studentData.students;
    return studentData.students.filter((s: any) => s.classroom_id === cid);
  }, [studentData.students, selectedClassroom, filterClassroom]);

  // Scope: teachers only see home visits of students in their homeroom
  const scopedStudentIds = useMemo(() => {
    if (!studentData.homeroomClassroomIds) return null;
    return studentData.students
      .filter((s: any) => studentData.homeroomClassroomIds!.includes(s.classroom_id))
      .map((s: any) => s.id);
  }, [studentData.homeroomClassroomIds, studentData.students]);

  const { data: records = [] } = useQuery({
    queryKey: ["home_visits", filterClassroom, scopedStudentIds?.join(",") || "all"],
    queryFn: async () => {
      let q = supabase.from("home_visits").select("*, students(student_code, prefix, first_name, last_name, classroom_id)").order("created_at", { ascending: false });
      if (filterClassroom && filterClassroom !== "all") q = q.eq("classroom_id", filterClassroom);
      if (scopedStudentIds) {
        if (scopedStudentIds.length === 0) return [];
        q = q.in("student_id", scopedStudentIds);
      }
      const { data } = await q;
      return data || [];
    },
  });

  useEffect(() => {
    if (profile) {
      setVisitorName(`${profile.first_name || ""} ${profile.last_name || ""}`.trim());
    }
  }, [profile]);

  const gradeLevels = [...new Set(classrooms.map((c: any) => c.grade_level))].sort();
  const availableClassrooms = studentData.availableClassrooms;
  const filteredClassrooms = studentData.filteredClassrooms;
  const formClassrooms = availableClassrooms;

  const getGPS = () => {
    if (!navigator.geolocation) {
      toast.error("GPS ไม่รองรับบนอุปกรณ์นี้");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toString());
        setLongitude(pos.coords.longitude.toString());
        toast.success("ได้รับพิกัด GPS แล้ว");
      },
      () => toast.error("ไม่สามารถเข้าถึงตำแหน่งได้")
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photoFiles.length + files.length > 10) {
      toast.error("อัปโหลดได้สูงสุด 10 รูป");
      return;
    }
    setPhotoFiles((prev) => [...prev, ...files]);
  };

  const removePhoto = (idx: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    const { compressImage } = await import("@/lib/imageCompress");
    const paths: string[] = [];
    for (const file of photoFiles) {
      const compressed = await compressImage(file, { maxWidth: 1280, maxSizeKB: 120 });
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await supabase.storage.from("home-visit-photos").upload(path, compressed);
      if (error) {
        toast.error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`);
        continue;
      }
      paths.push(path);
    }
    return paths;
  };

  const resetForm = () => {
    setStudentId("");
    setSelectedClassroom("");
    setHomeCondition("");
    setStudentCondition("");
    setFamilyStatus("");
    setRecommendations("");
    setPovertyStatus("ไม่ยากจน");
    setIncomePerMonth("");
    setHouseOwnership("");
    setLivingWith("");
    setNumFamilyMembers("");
    setHasInternet(false);
    setHasComputer(false);
    setTravelMethod("");
    setDistanceToSchool("");
    setLatitude("");
    setLongitude("");
    setPhotoFiles([]);
    setKosor01({});
  };

  const handleAdd = async () => {
    if (uploading) return;
    if (!studentId || !visitorName) {
      toast.error("กรุณาเลือกนักเรียนและระบุชื่อผู้เยี่ยม");
      return;
    }
    if (photoFiles.length < 3) {
      toast.error("กรุณาแนบรูปภาพอย่างน้อย 3 รูป");
      return;
    }

    setUploading(true);
    try {
      const photoUrls = await uploadPhotos();

      const { data: inserted, error } = await supabase.from("home_visits").insert({
        student_id: studentId,
        visitor_name: visitorName,
        home_condition: homeCondition,
        student_condition: studentCondition,
        family_status: familyStatus,
        recommendations,
        poverty_status: povertyStatus,
        income_per_month: incomePerMonth ? safeNum(incomePerMonth, null as any) : null,
        house_ownership: houseOwnership || null,
        living_with: livingWith || null,
        num_family_members: numFamilyMembers ? safeInt(numFamilyMembers, null as any) : null,
        has_internet: hasInternet,
        has_computer: hasComputer,
        travel_method: travelMethod || null,
        distance_to_school: distanceToSchool ? safeNum(distanceToSchool, null as any) : null,
        latitude: latitude ? safeNum(latitude, null as any) : null,
        longitude: longitude ? safeNum(longitude, null as any) : null,
        photo_urls: photoUrls,
        classroom_id: selectedClassroom || null,
        kosor01_data: kosor01,
      } as any).select("id").single();

      if (error) {
        toast.error(saveErrorMessage(error));
        return;
      }
      toast.success("บันทึกการเยี่ยมบ้านสำเร็จ");
      qc.invalidateQueries({ queryKey: ["home_visits"] });

      // Spider-web: แจ้งผู้ปกครองว่าครูมาเยี่ยมบ้าน
      notifyStudentEvent({
        student_id: studentId,
        title: "🏡 บันทึกการเยี่ยมบ้าน",
        body: `เยี่ยมบ้านโดย ${visitorName}`,
        type: "home_visit",
        severity: "info",
        reference_id: inserted?.id,
        reference_type: "home_visits",
        url: "/dashboard/student/home-visit",
        audience: { student: false, parents: true, homeroom: false },
      });

      setOpen(false);
      resetForm();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await swal.confirm({ title: "ยืนยันการลบ?", text: "ต้องการลบข้อมูลการเยี่ยมบ้านนี้หรือไม่", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("home_visits").delete().eq("id", id);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    qc.invalidateQueries({ queryKey: ["home_visits"] });
    toast.success("ลบข้อมูลแล้ว");
  };

  const getStudentName = (r: any) => {
    if (r.students) return `${r.students.prefix || ""}${r.students.first_name} ${r.students.last_name}`;
    return "-";
  };

  const getClassroomName = (classroomId: string | null) => {
    if (!classroomId) return "-";
    const c = classrooms.find((cl: any) => cl.id === classroomId);
    return c ? c.name : "-";
  };

  const handlePrintVisit = async (r: any) => {
    const studentName = getStudentName(r);
    const classroomName = getClassroomName(r.classroom_id);
    const signedPhotos = r.photo_urls?.length
      ? await Promise.all(r.photo_urls.map((p: string) => resolveStorageUrl("home-visit-photos", p)))
      : [];

    const studentRow = studentData.students.find((s: any) => s.id === r.student_id);
    const kosor = (r as any).kosor01_data || {};

    const formHtml = renderKosor01Html(kosor, {
      schoolName: schoolInfo.school_name,
      schoolAddress: schoolInfo.school_address,
      schoolAffiliation: (schoolInfo as any).school_affiliation || "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน",
      schoolLogo: schoolInfo.school_logo,
      semester,
      academicYear: academicYear ? academicYear + BE_OFFSET : "",
      studentName,
      studentCode: studentRow?.student_code,
      studentNationalId: (studentRow as any)?.national_id || (studentRow as any)?.id_card,
      classroomName,
      visitDate: r.visit_date,
      visitorName: r.visitor_name,
      directorName: schoolInfo.director_name,
      directorTitle: schoolInfo.director_title,
      povertyStatus: r.poverty_status,
      latitude: r.latitude,
      longitude: r.longitude,
    });

    const extraHtml = `
      ${(r.home_condition || r.student_condition || r.family_status || r.recommendations) ? `
        <div class="k-section" style="font-family:'TH Sarabun New',Sarabun,sans-serif;font-size:16pt;">
          <div class="k-section-title" style="font-weight:700;background:#eef;padding:4px 8px;border-left:4px solid #335;margin:10px 0 6px;">บันทึกเพิ่มเติมจากการเยี่ยมบ้าน</div>
          ${r.home_condition ? `<div><b>สภาพบ้าน:</b> ${r.home_condition}</div>` : ""}
          ${r.student_condition ? `<div><b>สภาพนักเรียน:</b> ${r.student_condition}</div>` : ""}
          ${r.family_status ? `<div><b>สถานะครอบครัว:</b> ${r.family_status}</div>` : ""}
          ${r.recommendations ? `<div><b>ข้อเสนอแนะ:</b> ${r.recommendations}</div>` : ""}
        </div>` : ""}
      ${signedPhotos.length > 0 ? `
        <div class="k-section" style="font-family:'TH Sarabun New',Sarabun,sans-serif;font-size:16pt;">
          <div class="k-section-title" style="font-weight:700;background:#eef;padding:4px 8px;border-left:4px solid #335;margin:10px 0 6px;">รูปภาพประกอบการเยี่ยมบ้าน</div>
          <div class="k-photos" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
            ${signedPhotos.map((url: string) => `<img loading="lazy" decoding="async" src="${url}" alt="visit" style="width:100%;height:140px;object-fit:cover;border:1px solid #999;" />`).join("")}
          </div>
        </div>` : ""}
      <div style="font-family:'TH Sarabun New',Sarabun,sans-serif;font-size:14pt;text-align:right;margin-top:12px;">วันที่พิมพ์ ${currentThaiDate()}</div>
    `;

    openPrintWindow(formHtml + extraHtml, { title: `กสศ.01 - ${studentName}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{lang === "th" ? "ระบบเยี่ยมบ้านนักเรียน" : "Home Visit System"}</h1>
          <p className="text-sm text-muted-foreground">{lang === "th" ? "บันทึกการเยี่ยมบ้านตามมาตรฐาน สพฐ." : "OBEC standard home visit records"}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {academicYear > 0 && <AcademicYearFilter compact academicYear={academicYear} onAcademicYearChange={setAcademicYear} semester={semester} onSemesterChange={setSemester} academicYearOptions={academicYearOptions} allowAllSemesters />}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setSummaryOpen(true)}>
          <FileText className="w-4 h-4 mr-2" />{lang === "th" ? "แบบสรุปรายงานเยี่ยมบ้าน" : "Summary Report"}
        </Button>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "บันทึกเยี่ยมบ้าน" : "New Visit"}</Button></DialogTrigger>
          <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>{lang === "th" ? "แบบบันทึกการเยี่ยมบ้านนักเรียน" : "Home Visit Record Form"}</DialogTitle></DialogHeader>
            <ScrollArea className="flex-1 min-h-0 pr-4">
              <div className="space-y-6">
                {/* Section 1: Student Selection */}
                <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">ข้อมูลนักเรียน</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>ระดับชั้น/ห้อง</Label>
                        <Select value={selectedClassroom} onValueChange={(v) => { setSelectedClassroom(v); setStudentId(""); }}>
                          <SelectTrigger><SelectValue placeholder="เลือกห้องเรียน" /></SelectTrigger>
                          <SelectContent>{formClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select></div>
                      <div><Label>นักเรียน</Label>
                        <Select value={studentId} onValueChange={setStudentId}>
                          <SelectTrigger><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger>
                          <SelectContent>{formStudents.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.student_code} - {s.prefix}{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
                        </Select></div>
                    </div>
                    <div><Label>ผู้เยี่ยมบ้าน (ครูประจำชั้น)</Label>
                      <Input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} /></div>
                  </CardContent></Card>

                {/* Section 2: Home Info */}
                <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">สภาพที่อยู่อาศัย</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>สภาพบ้าน</Label>
                        <Select value={houseOwnership} onValueChange={setHouseOwnership}>
                          <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="บ้านของตนเอง">บ้านของตนเอง</SelectItem>
                            <SelectItem value="บ้านเช่า">บ้านเช่า</SelectItem>
                            <SelectItem value="อาศัยผู้อื่น">อาศัยผู้อื่น</SelectItem>
                            <SelectItem value="หอพัก">หอพัก</SelectItem>
                          </SelectContent></Select></div>
                      <div><Label>อาศัยอยู่กับ</Label>
                        <Select value={livingWith} onValueChange={setLivingWith}>
                          <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="บิดา-มารดา">บิดา-มารดา</SelectItem>
                            <SelectItem value="บิดา">บิดา</SelectItem>
                            <SelectItem value="มารดา">มารดา</SelectItem>
                            <SelectItem value="ปู่-ย่า/ตา-ยาย">ปู่-ย่า/ตา-ยาย</SelectItem>
                            <SelectItem value="ญาติ">ญาติ</SelectItem>
                            <SelectItem value="อื่นๆ">อื่นๆ</SelectItem>
                          </SelectContent></Select></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>จำนวนสมาชิกในครอบครัว (คน)</Label>
                        <Input type="number" min="1" value={numFamilyMembers} onChange={(e) => setNumFamilyMembers(e.target.value)} /></div>
                      <div><Label>รายได้ครอบครัว/เดือน (บาท)</Label>
                        <Input type="number" min="0" value={incomePerMonth} onChange={(e) => setIncomePerMonth(e.target.value)} /></div>
                    </div>
                    <div><Label>สถานะความยากจน</Label>
                      <Select value={povertyStatus} onValueChange={setPovertyStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ไม่ยากจน">ไม่ยากจน</SelectItem>
                          <SelectItem value="ยากจน">ยากจน</SelectItem>
                          <SelectItem value="ยากจนพิเศษ">ยากจนพิเศษ</SelectItem>
                        </SelectContent></Select></div>
                    <Textarea placeholder="สภาพบ้านเพิ่มเติม..." value={homeCondition} onChange={(e) => setHomeCondition(e.target.value)} />
                  </CardContent></Card>

                {/* Section 3: Student & Family Status */}
                <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">สภาพนักเรียนและครอบครัว</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div><Label>สภาพนักเรียน</Label>
                      <Textarea value={studentCondition} onChange={(e) => setStudentCondition(e.target.value)} placeholder="สุขภาพ, พฤติกรรม, ความเป็นอยู่..." /></div>
                    <div><Label>สถานะครอบครัว</Label>
                      <Textarea value={familyStatus} onChange={(e) => setFamilyStatus(e.target.value)} placeholder="ความสัมพันธ์ในครอบครัว, ปัญหา..." /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2"><Switch checked={hasInternet} onCheckedChange={setHasInternet} /><Label>มีอินเทอร์เน็ตที่บ้าน</Label></div>
                      <div className="flex items-center gap-2"><Switch checked={hasComputer} onCheckedChange={setHasComputer} /><Label>มีคอมพิวเตอร์/แท็บเล็ต</Label></div>
                    </div>
                  </CardContent></Card>

                {/* Section 4: Travel */}
                <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">การเดินทาง</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>วิธีเดินทางมาโรงเรียน</Label>
                        <Select value={travelMethod} onValueChange={setTravelMethod}>
                          <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="เดินเท้า">เดินเท้า</SelectItem>
                            <SelectItem value="จักรยาน">จักรยาน</SelectItem>
                            <SelectItem value="รถจักรยานยนต์">รถจักรยานยนต์</SelectItem>
                            <SelectItem value="รถยนต์">รถยนต์</SelectItem>
                            <SelectItem value="รถโรงเรียน">รถโรงเรียน</SelectItem>
                            <SelectItem value="รถสาธารณะ">รถสาธารณะ</SelectItem>
                          </SelectContent></Select></div>
                      <div><Label>ระยะทาง (กม.)</Label>
                        <Input type="number" min="0" step="0.1" value={distanceToSchool} onChange={(e) => setDistanceToSchool(e.target.value)} /></div>
                    </div>
                  </CardContent></Card>

                {/* Section 5: GPS */}
                <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">พิกัด GPS</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Button type="button" variant="outline" onClick={getGPS}><MapPin className="w-4 h-4 mr-2" />ดึงพิกัดจาก GPS</Button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label>Latitude</Label><Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="เช่น 13.7563" /></div>
                      <div><Label>Longitude</Label><Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="เช่น 100.5018" /></div>
                    </div>
                  </CardContent></Card>

                {/* Section 6: Photos */}
                <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">รูปภาพการเยี่ยมบ้าน (อย่างน้อย 3 รูป)</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {photoFiles.map((f, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                          <img loading="lazy" decoding="async" src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removePhoto(i)} className="absolute top-0 right-0 bg-destructive text-white rounded-bl p-0.5"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                        <Camera className="w-6 h-6 text-muted-foreground" />
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">เลือกรูป {photoFiles.length}/10 (ต้องมีอย่างน้อย 3 รูป)</p>
                  </CardContent></Card>

                {/* Section 7: นร./กสศ. 01 */}
                <Kosor01FormSection value={kosor01} onChange={setKosor01} />

                {/* Section 8: Recommendations */}
                <div><Label>ข้อเสนอแนะ / สรุปผลการเยี่ยมบ้าน</Label>
                  <Textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} rows={3} /></div>

                <Button onClick={handleAdd} className="w-full" disabled={uploading}>
                  {uploading ? <><Upload className="w-4 h-4 mr-2 animate-spin" />กำลังบันทึก...</> : "บันทึกการเยี่ยมบ้าน"}
                </Button>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-48"><Label className="text-xs">ระดับชั้น</Label>
            <Select value={filterGrade} onValueChange={(v) => { setFilterGrade(v); setFilterClassroom(""); }}>
              <SelectTrigger><SelectValue placeholder="ทุกระดับชั้น" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับชั้น</SelectItem>
                {gradeLevels.map((g: string) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent></Select></div>
          <div className="w-48"><Label className="text-xs">ห้องเรียน</Label>
            <Select value={filterClassroom} onValueChange={setFilterClassroom}>
              <SelectTrigger><SelectValue placeholder="ทุกห้อง" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกห้อง</SelectItem>
                {filteredClassrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.homeroom_teacher ? `(${c.homeroom_teacher})` : ""}</SelectItem>)}
              </SelectContent></Select></div>
        </div>
      </CardContent></Card>

      {/* Records Table (roster view — 1 row per student) */}
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>นักเรียน</TableHead>
            <TableHead>ห้อง</TableHead>
            <TableHead>วันที่เยี่ยมล่าสุด</TableHead>
            <TableHead>ผู้เยี่ยม</TableHead>
            <TableHead>สถานะยากจน</TableHead>
            <TableHead>GPS</TableHead>
            <TableHead className="text-center">ครั้ง</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(() => {
              const rosterRows = (studentData.filteredStudents as any[]).map((s: any) => {
                const recs = (records as any[]).filter((r) => r.student_id === s.id);
                return { student: s, latest: recs[0] || null, count: recs.length };
              });
              return <>
                {rosterRows.map(({ student: s, latest: r, count }) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.student_code} {s.prefix || ""}{s.first_name} {s.last_name}</TableCell>
                    <TableCell>{s?.classrooms?.name || getClassroomName(s.classroom_id)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r ? r.visit_date : <span className="text-muted-foreground text-xs">ยังไม่เยี่ยม</span>}
                    </TableCell>
                    <TableCell>{r?.visitor_name || "—"}</TableCell>
                    <TableCell>
                      {r ? (
                        <Badge variant={r.poverty_status === "ยากจนพิเศษ" ? "destructive" : r.poverty_status === "ยากจน" ? "secondary" : "outline"}>
                          {r.poverty_status || "-"}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{r?.latitude && r?.longitude ? <MapPin className="w-4 h-4 text-green-600" /> : "—"}</TableCell>
                    <TableCell className="text-center">{count}</TableCell>
                    <TableCell className="flex gap-1">
                      {r && <>
                        <Button variant="ghost" size="sm" onClick={() => setViewRecord(r)}><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handlePrintVisit(r)}><Printer className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </>}
                    </TableCell>
                  </TableRow>
                ))}
                {rosterRows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>}
              </>;
            })()}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* View Dialog */}
      <Dialog open={!!viewRecord} onOpenChange={(v) => !v && setViewRecord(null)}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>รายละเอียดการเยี่ยมบ้าน</DialogTitle>
              {viewRecord && <Button variant="outline" size="sm" onClick={() => handlePrintVisit(viewRecord)}><Printer className="w-4 h-4 mr-2" />พิมพ์</Button>}
            </div>
          </DialogHeader>
          {viewRecord && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="font-semibold">นักเรียน:</span> {getStudentName(viewRecord)}</div>
                  <div><span className="font-semibold">วันที่:</span> {viewRecord.visit_date}</div>
                  <div><span className="font-semibold">ผู้เยี่ยม:</span> {viewRecord.visitor_name}</div>
                  <div><span className="font-semibold">สถานะยากจน:</span> {viewRecord.poverty_status || "-"}</div>
                  <div><span className="font-semibold">รายได้/เดือน:</span> {viewRecord.income_per_month ? `${viewRecord.income_per_month} บาท` : "-"}</div>
                  <div><span className="font-semibold">ที่อยู่อาศัย:</span> {viewRecord.house_ownership || "-"}</div>
                  <div><span className="font-semibold">อาศัยอยู่กับ:</span> {viewRecord.living_with || "-"}</div>
                  <div><span className="font-semibold">สมาชิก:</span> {viewRecord.num_family_members || "-"} คน</div>
                  <div><span className="font-semibold">อินเทอร์เน็ต:</span> {viewRecord.has_internet ? "มี" : "ไม่มี"}</div>
                  <div><span className="font-semibold">คอมพิวเตอร์:</span> {viewRecord.has_computer ? "มี" : "ไม่มี"}</div>
                  <div><span className="font-semibold">การเดินทาง:</span> {viewRecord.travel_method || "-"}</div>
                  <div><span className="font-semibold">ระยะทาง:</span> {viewRecord.distance_to_school ? `${viewRecord.distance_to_school} กม.` : "-"}</div>
                </div>
                {viewRecord.home_condition && <div><span className="font-semibold text-sm">สภาพบ้าน:</span><p className="text-sm mt-1">{viewRecord.home_condition}</p></div>}
                {viewRecord.student_condition && <div><span className="font-semibold text-sm">สภาพนักเรียน:</span><p className="text-sm mt-1">{viewRecord.student_condition}</p></div>}
                {viewRecord.family_status && <div><span className="font-semibold text-sm">สถานะครอบครัว:</span><p className="text-sm mt-1">{viewRecord.family_status}</p></div>}
                {viewRecord.recommendations && <div><span className="font-semibold text-sm">ข้อเสนอแนะ:</span><p className="text-sm mt-1">{viewRecord.recommendations}</p></div>}
                {viewRecord.latitude && viewRecord.longitude && (
                  <div>
                    <span className="font-semibold text-sm">พิกัด GPS:</span>
                    <a href={`https://www.google.com/maps?q=${viewRecord.latitude},${viewRecord.longitude}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary ml-2 underline">
                      {viewRecord.latitude}, {viewRecord.longitude} ↗
                    </a>
                  </div>
                )}
                {viewRecord.photo_urls?.length > 0 && (
                  <div>
                    <span className="font-semibold text-sm">รูปภาพ:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                      {viewRecord.photo_urls.map((url: string, i: number) => (
                        <SignedImage key={i} bucket="home-visit-photos" path={url} alt={`Visit ${i + 1}`} className="w-full h-32 object-cover rounded-lg border border-border" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <HomeVisitSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        academicYear={academicYear}
        semester={semester}
      />
    </div>
  );
};

export default HomeVisitPage;
