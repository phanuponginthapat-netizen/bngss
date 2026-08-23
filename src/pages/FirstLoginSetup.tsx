import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuthSession } from "@/hooks/useAuthSession";
import { toast } from "sonner";
import { CheckCircle, ArrowRight, Briefcase, User, ShieldCheck } from "lucide-react";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { saveErrorMessage } from "@/lib/saveError";

interface FirstLoginSetupProps {
  userId: string;
  onComplete: () => void;
}

const SUBJECT_GROUPS = [
  "ปฐมวัย",
  "ภาษาไทย", "คณิตศาสตร์", "วิทยาศาสตร์และเทคโนโลยี",
  "สังคมศึกษา ศาสนาและวัฒนธรรม", "สุขศึกษาและพลศึกษา",
  "ศิลปะ", "การงานอาชีพ", "ภาษาต่างประเทศ",
];

const POSITIONS = ["ครู", "ครูผู้ช่วย", "ครูอัตราจ้าง", "พนักงานราชการ", "ลูกจ้างประจำ", "ลูกจ้างชั่วคราว", "ICT Talent", "School Partner", "ConnextED"];

const POSITION_LEVELS = [
  "ครูผู้ช่วย", "ค.ศ. 1", "ค.ศ. 2 (ชำนาญการ)",
  "ค.ศ. 3 (ชำนาญการพิเศษ)", "ค.ศ. 4 (เชี่ยวชาญ)", "ค.ศ. 5 (เชี่ยวชาญพิเศษ)",
];

const DEPARTMENTS = ["วิชาการ", "กิจการนักเรียน", "บริหารทั่วไป", "งบประมาณและบุคคล", "ConnextED"];

const PREFIXES_MALE = ["เด็กชาย", "นาย"];
const PREFIXES_FEMALE = ["เด็กหญิง", "นางสาว", "นาง"];

const FirstLoginSetup = ({ userId, onComplete }: FirstLoginSetupProps) => {
  const { lang } = useLanguage();
  const { role } = useUserRole();
  const { user } = useAuthSession();
  const isTeacher = role === "teacher" || role === "director";
  // Steps: 1 = PDPA, 2 = Personal, [3 = Personnel (teacher only)] — no password step
  const totalSteps = isTeacher ? 3 : 2;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 0: PDPA
  const [pdpaAccepted, setPdpaAccepted] = useState(false);
  const PDPA_VERSION = "1.0";

  // Step 1: Profile
  const [prefix, setPrefix] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  // Step 2 (teacher): HR / Personnel
  const [generatedCode, setGeneratedCode] = useState("");
  const [position, setPosition] = useState("ครู");
  const [positionLevel, setPositionLevel] = useState("");
  const [department, setDepartment] = useState("วิชาการ");
  const [subjectGroup, setSubjectGroup] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [academicStanding, setAcademicStanding] = useState("");

  // National ID (citizen) — for students; prefilled if available
  const [nationalId, setNationalId] = useState("");

  // Track prefilled state so we can show hints + avoid regenerating codes
  const [prefilled, setPrefilled] = useState(false);
  const [existingStudentCode, setExistingStudentCode] = useState("");
  const [existingEmployeeCode, setExistingEmployeeCode] = useState("");

  // Auto-set prefix based on gender (only if user hasn't already chosen one)
  // Students default to เด็กชาย/เด็กหญิง, others to นาย/นางสาว
  useEffect(() => {
    const isStudent = role === "student";
    if (gender === "male" && !prefix) setPrefix(isStudent ? "เด็กชาย" : "นาย");
    if (gender === "female" && !prefix) setPrefix(isStudent ? "เด็กหญิง" : "นางสาว");
  }, [gender, role]);

  // Prefill from existing profile / student / personnel records on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: prof }, { data: stu }, { data: per }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          supabase.from("students").select("*").eq("auth_user_id", userId).maybeSingle(),
          supabase.from("personnel").select("*").eq("user_id", userId).maybeSingle(),
        ]);
        if (cancelled) return;
        const p: any = prof || {};
        const s: any = stu || {};
        const e: any = per || {};
        const pick = (...vals: any[]) => vals.find((v) => v !== null && v !== undefined && v !== "") ?? "";
        setPrefix(pick(e.prefix, s.prefix, prefix));
        setFirstName(pick(p.first_name, s.first_name, e.first_name));
        setLastName(pick(p.last_name, s.last_name, e.last_name));
        setNickname(pick(p.nickname));
        setPhone(pick(p.phone, s.phone, e.phone));
        setGender(pick(p.gender, s.gender));
        setDateOfBirth(pick(p.date_of_birth, s.date_of_birth));
        setNationalId(pick(s.national_id));
        // HR fields
        setPosition(pick(e.position, p.position_title) || "ครู");
        setPositionLevel(pick(e.position_level));
        setDepartment(pick(e.department, p.department) || "วิชาการ");
        setSubjectGroup(pick(e.subject_group));
        setHireDate(pick(e.hire_date, p.hire_date));
        setAcademicStanding(pick(e.academic_standing));
        // Existing codes — reuse, don't regenerate
        const stuCode = pick(p.student_code, s.student_code);
        const empCode = pick(p.employee_code, e.employee_code);
        if (stuCode) { setExistingStudentCode(stuCode); setGeneratedCode(stuCode); }
        if (empCode) { setExistingEmployeeCode(empCode); setGeneratedCode(empCode); }
        setPrefilled(true);
      } catch {
        setPrefilled(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);


  const prefixOptions = gender === "male" ? PREFIXES_MALE : gender === "female" ? PREFIXES_FEMALE : [...PREFIXES_MALE, ...PREFIXES_FEMALE];

  const handlePdpaSubmit = async () => {
    if (!pdpaAccepted) {
      toast.error(lang === "th" ? "กรุณายอมรับข้อตกลงก่อนใช้งานระบบ" : "Please accept the agreement to continue");
      return;
    }
    setLoading(true);
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
      await supabase.from("pdpa_consents").insert({
        user_id: userId,
        consent_version: PDPA_VERSION,
        accepted: true,
        user_agent: ua,
      } as any);
      await supabase.from("profiles").update({
        pdpa_accepted_at: new Date().toISOString(),
        pdpa_version: PDPA_VERSION,
      } as any).eq("id", userId);
      setStep(2);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const generateStudentCode = async (): Promise<string> => {
    const { data } = await supabase
      .from("students")
      .select("student_code")
      .ilike("student_code", "s%")
      .order("student_code", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
      const numPart = parseInt(data[0].student_code.replace(/^s/i, ""), 10);
      if (!isNaN(numPart)) nextNum = numPart + 1;
    }
    return `s${String(nextNum).padStart(4, "0")}`;
  };

  const handleProfileSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error(lang === "th" ? "กรุณากรอกชื่อและนามสกุล" : "Please enter first and last name");
      return;
    }
    if (nationalId.trim()) {
      const { isValidThaiNationalId } = await import("@/lib/formValidation");
      if (!isValidThaiNationalId(nationalId.trim())) {
        toast.error(lang === "th" ? "เลขบัตรประชาชนไม่ถูกต้อง (checksum ไม่ผ่าน)" : "Invalid Thai National ID (checksum failed)");
        return;
      }
    }
    setLoading(true);


    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        nickname: nickname.trim() || null,
        phone: phone.trim() || null,
        gender: gender || null,
        date_of_birth: dateOfBirth || null,
      })
      .eq("id", userId);

    if (error) {
      toast.error(saveErrorMessage(error));
      setLoading(false);
      return;
    }

    // For students, reuse existing student_code if any; otherwise auto-generate
    if (role === "student") {
      const studentCode = existingStudentCode || (await generateStudentCode());

      // Check if student record exists
      const { data: existingStudent } = await supabase
        .from("students")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (existingStudent) {
        await supabase.from("students").update({
          prefix: prefix || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          student_code: studentCode,
          national_id: nationalId.trim() || null,
        } as any).eq("id", existingStudent.id);
      } else {
        await supabase.from("students").insert({
          auth_user_id: userId,
          prefix: prefix || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          student_code: studentCode,
          national_id: nationalId.trim() || null,
          status: "active",
        } as any);
      }

      await supabase.from("profiles").update({ student_code: studentCode }).eq("id", userId);
      setGeneratedCode(studentCode);
    }


    if (isTeacher) {
      setStep(3);
    } else {
      await supabase.from("school_settings").upsert({ setting_key: `first_login_done_${userId}`, setting_value: "true" }, { onConflict: "setting_key" });
      toast.success(lang === "th" ? "ตั้งค่าเสร็จสมบูรณ์!" : "Setup complete!");
      onComplete();
    }
    setLoading(false);
  };

  const generateEmployeeCode = async (codePrefix: string): Promise<string> => {
    const { data } = await supabase
      .from("personnel")
      .select("employee_code")
      .ilike("employee_code", `${codePrefix}%`)
      .order("employee_code", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
      const lastCode = data[0].employee_code;
      const numPart = parseInt(lastCode.replace(codePrefix, ""), 10);
      if (!isNaN(numPart)) nextNum = numPart + 1;
    }
    return `${codePrefix}${String(nextNum).padStart(4, "0")}`;
  };

  const handlePersonnelSubmit = async () => {
    setLoading(true);

    // Reuse existing employee code if any; otherwise auto-generate
    const codePrefix = (role === "director" || role === "admin") ? "d" : "t";
    const autoCode = existingEmployeeCode || (await generateEmployeeCode(codePrefix));
    setGeneratedCode(autoCode);


    // Check if personnel record already exists for this user
    const { data: existing } = await supabase
      .from("personnel")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const personnelData = {
      prefix: prefix || null,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      employee_code: autoCode,
      position,
      position_level: positionLevel || null,
      department,
      subject_group: subjectGroup || null,
      hire_date: hireDate || null,
      academic_standing: academicStanding || null,
      email: user?.email || null,
      phone: phone.trim() || null,
      user_id: userId,
      status: "active",
    };

    let error;
    if (existing) {
      ({ error } = await supabase.from("personnel").update(personnelData).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("personnel").insert(personnelData));
    }

    // Also update profile with employee_code, position, department, hire_date
    await supabase.from("profiles").update({
      employee_code: autoCode,
      position_title: position,
      department,
      hire_date: hireDate || null,
    }).eq("id", userId);

    if (error) {
      toast.error(saveErrorMessage(error));
    } else {
      await supabase.from("school_settings").upsert({ setting_key: `first_login_done_${userId}`, setting_value: "true" }, { onConflict: "setting_key" });
      toast.success(lang === "th" ? "ตั้งค่าเสร็จสมบูรณ์!" : "Setup complete!");
      onComplete();
    }
    setLoading(false);
  };

  const stepTitles = isTeacher
    ? [
        { title: lang === "th" ? "ข้อตกลง PDPA" : "PDPA Consent", icon: ShieldCheck },
        { title: lang === "th" ? "ข้อมูลส่วนตัว" : "Personal Info", icon: User },
        { title: lang === "th" ? "ข้อมูลบุคลากร" : "Personnel Info", icon: Briefcase },
      ]
    : [
        { title: lang === "th" ? "ข้อตกลง PDPA" : "PDPA Consent", icon: ShieldCheck },
        { title: lang === "th" ? "ข้อมูลส่วนตัว" : "Personal Info", icon: User },
      ];

  const titleIndex = step - 1;
  const currentTitle = stepTitles[titleIndex] ?? stepTitles[0];
  const displayStep = step;

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center gradient-primary relative overflow-hidden px-4 py-8">
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-primary-foreground/5" />
      <div className="absolute bottom-[-15%] left-[-8%] w-[500px] h-[500px] rounded-full bg-primary-foreground/5" />

      <Card className="w-full max-w-lg shadow-card-hover border-0 relative z-10 max-h-[90vh] overflow-y-auto">
        <CardHeader className="text-center pb-2 pt-6">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {stepTitles.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-0.5 transition-all ${step > i ? "bg-primary" : "bg-muted"}`} />}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i ? "gradient-primary text-primary-foreground shadow-lg" : step === i + 1 ? "gradient-primary text-primary-foreground shadow-lg ring-2 ring-primary/30" : "bg-muted text-muted-foreground"}`}>
                  {step > i ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
              </div>
            ))}
          </div>
          <h1 className="text-lg font-bold text-foreground">{currentTitle.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === "th" ? `ขั้นตอนที่ ${displayStep} จาก ${totalSteps}` : `Step ${displayStep} of ${totalSteps}`}
          </p>
        </CardHeader>

        <CardContent className="pt-2 pb-6">
          {/* Step 1: PDPA Consent */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  {lang === "th"
                    ? "ก่อนเริ่มใช้งาน กรุณาอ่านและยอมรับข้อตกลงการเก็บและใช้ข้อมูลส่วนบุคคล (PDPA) ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562"
                    : "Before continuing, please read and accept the Personal Data Protection (PDPA) agreement under the Thai PDPA Act B.E. 2562."}
                </div>
              </div>
              <ScrollArea className="h-64 rounded-lg border p-4 bg-muted/20">
                <div className="text-xs space-y-3 text-foreground/90 leading-relaxed">
                  <p className="font-semibold text-sm">
                    {lang === "th" ? "ข้อตกลงการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล" : "Data Collection, Use, and Disclosure Agreement"}
                  </p>
                  <p>{lang === "th" ? "1. วัตถุประสงค์ของการเก็บข้อมูล" : "1. Purpose of Data Collection"}</p>
                  <p className="pl-3">{lang === "th"
                    ? "โรงเรียนเก็บรวบรวมข้อมูลส่วนบุคคลเพื่อใช้ในการบริหารจัดการการศึกษา การติดต่อสื่อสาร การรายงานต่อหน่วยงานต้นสังกัด (สพฐ./เขตพื้นที่) และการให้บริการตามภารกิจของสถานศึกษา"
                    : "The school collects personal data for educational administration, communication, reporting to authorities (OBEC/District), and providing school services."}
                  </p>
                  <p>{lang === "th" ? "2. ประเภทข้อมูลที่เก็บ" : "2. Data Collected"}</p>
                  <p className="pl-3">{lang === "th"
                    ? "ข้อมูลทั่วไป (ชื่อ-นามสกุล เบอร์โทร อีเมล รูปถ่าย) ข้อมูลทางการศึกษา (ผลการเรียน การเข้าเรียน) และข้อมูลที่จำเป็นต่อการให้บริการ"
                    : "General data (name, phone, email, photo), educational data (grades, attendance), and other data required for service."}
                  </p>
                  <p>{lang === "th" ? "3. การเปิดเผยข้อมูล" : "3. Data Disclosure"}</p>
                  <p className="pl-3">{lang === "th"
                    ? "ข้อมูลของท่านจะไม่ถูกเปิดเผยต่อบุคคลภายนอก ยกเว้นกรณีที่กฎหมายกำหนด หรือได้รับความยินยอมจากท่าน ข้อมูลติดต่อพื้นฐานอาจปรากฏในโปรไฟล์สาธารณะผ่าน QR Code บนบัตรประจำตัว"
                    : "Your data will not be disclosed to third parties except as required by law or with your consent. Basic contact info may appear on the public profile via ID-card QR code."}
                  </p>
                  <p>{lang === "th" ? "4. สิทธิของเจ้าของข้อมูล" : "4. Your Rights"}</p>
                  <p className="pl-3">{lang === "th"
                    ? "ท่านมีสิทธิเข้าถึง แก้ไข ลบ ระงับการใช้ และถอนความยินยอมได้ตลอดเวลา โดยติดต่อผู้ดูแลระบบของโรงเรียน"
                    : "You have the right to access, edit, delete, restrict use, and withdraw consent at any time by contacting the school administrator."}
                  </p>
                  <p>{lang === "th" ? "5. ระยะเวลาเก็บรักษา" : "5. Retention Period"}</p>
                  <p className="pl-3">{lang === "th"
                    ? "ข้อมูลจะถูกเก็บตลอดระยะเวลาที่ท่านเป็นสมาชิกของสถานศึกษา และเก็บเพิ่มเติมตามระเบียบของกระทรวงศึกษาธิการ"
                    : "Data will be retained while you are a member of the school and as required by Ministry of Education regulations."}
                  </p>
                  <p>{lang === "th" ? "6. การรักษาความปลอดภัย" : "6. Security"}</p>
                  <p className="pl-3">{lang === "th"
                    ? "ระบบใช้มาตรการทางเทคนิคในการปกป้องข้อมูล (การเข้ารหัส, RLS, สิทธิ์ตามบทบาท) เพื่อป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต"
                    : "Technical measures (encryption, RLS, role-based access) protect data from unauthorized access."}
                  </p>
                </div>
              </ScrollArea>
              <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors">
                <Checkbox
                  checked={pdpaAccepted}
                  onCheckedChange={(c) => setPdpaAccepted(c === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  {lang === "th"
                    ? "ข้าพเจ้าได้อ่าน เข้าใจ และยินยอมให้โรงเรียนเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลตามข้อตกลงข้างต้น"
                    : "I have read, understood, and consent to the collection, use, and disclosure of my personal data per the agreement above."}
                </span>
              </label>
              <Button onClick={handlePdpaSubmit} className="w-full h-10 gradient-primary text-primary-foreground font-semibold gap-2" disabled={loading || !pdpaAccepted}>
                {loading ? "..." : <>{lang === "th" ? "ยอมรับและดำเนินการต่อ" : "Accept & Continue"} <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </div>
          )}

          {/* Step 2: Personal Info */}
          {step === 2 && (
            <div className="space-y-3">
              {prefilled && (firstName || lastName || existingStudentCode || existingEmployeeCode) && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/30">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-foreground/80">
                    {lang === "th"
                      ? "ดึงข้อมูลเดิมของท่านมาให้แล้ว ตรวจสอบและแก้ไขได้หากต้องการ"
                      : "Your existing data has been pre-filled. Review and edit if needed."}
                    {(existingStudentCode || existingEmployeeCode) && (
                      <span className="ml-1 font-semibold">
                        ({lang === "th" ? "รหัสเดิม" : "Code"}: {existingStudentCode || existingEmployeeCode})
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">

                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "เพศ *" : "Gender *"}</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={lang === "th" ? "เลือก" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{lang === "th" ? "ชาย" : "Male"}</SelectItem>
                      <SelectItem value="female">{lang === "th" ? "หญิง" : "Female"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "คำนำหน้า" : "Prefix"}</Label>
                  <Select value={prefix} onValueChange={setPrefix}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={lang === "th" ? "เลือก" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {prefixOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "ชื่อ *" : "First Name *"}</Label>
                  <Input className="h-9" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={lang === "th" ? "ชื่อ" : "First name"} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "นามสกุล *" : "Last Name *"}</Label>
                  <Input className="h-9" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={lang === "th" ? "นามสกุล" : "Last name"} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "ชื่อเล่น" : "Nickname"}</Label>
                  <Input className="h-9" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={lang === "th" ? "ไม่บังคับ" : "Optional"} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "เบอร์โทร" : "Phone"}</Label>
                  <Input className="h-9" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{lang === "th" ? "วันเกิด" : "Date of Birth"}</Label>
                <BEDatePicker value={dateOfBirth} onChange={(v) => setDateOfBirth(v)} className="h-9" />
              </div>
              {role === "student" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "เลขบัตรประชาชน" : "National ID"}</Label>
                  <Input
                    className="h-9"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    placeholder="x-xxxx-xxxxx-xx-x"
                    inputMode="numeric"
                  />
                </div>
              )}

              <Button onClick={handleProfileSubmit} className="w-full h-10 gradient-primary text-primary-foreground font-semibold gap-2 mt-2" disabled={loading}>
                {loading ? "..." : <>{lang === "th" ? "ถัดไป" : "Next"} <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </div>
          )}

          {/* Step 2 (Teacher): Personnel / HR Info */}
          {step === 3 && isTeacher && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground">
                  {existingEmployeeCode
                    ? (lang === "th" ? `ใช้รหัสพนักงานเดิม: ${existingEmployeeCode}` : `Using existing employee code: ${existingEmployeeCode}`)
                    : (lang === "th" ? "รหัสพนักงานจะถูกสร้างอัตโนมัติเมื่อกดบันทึก" : "Employee code will be auto-generated")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{lang === "th" ? "ตำแหน่ง" : "Position"}</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "วิทยฐานะ" : "Position Level"}</Label>
                  <Select value={positionLevel} onValueChange={setPositionLevel}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={lang === "th" ? "เลือก" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {POSITION_LEVELS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "ฝ่ายงาน" : "Department"}</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "กลุ่มสาระ/วิชาเอก" : "Subject Group"}</Label>
                  <Select value={subjectGroup} onValueChange={setSubjectGroup}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={lang === "th" ? "เลือก" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {SUBJECT_GROUPS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "th" ? "วันที่เข้าทำงาน" : "Hire Date"}</Label>
                  <BEDatePicker value={hireDate} onChange={(v) => setHireDate(v)} className="h-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{lang === "th" ? "วุฒิการศึกษา" : "Academic Standing"}</Label>
                <Input className="h-9" value={academicStanding} onChange={(e) => setAcademicStanding(e.target.value)} placeholder={lang === "th" ? "เช่น ปริญญาตรี ศึกษาศาสตร์" : "e.g. B.Ed."} />
              </div>
              <Button onClick={handlePersonnelSubmit} className="w-full h-10 gradient-primary text-primary-foreground font-semibold gap-2 mt-2" disabled={loading}>
                {loading ? "..." : <>{lang === "th" ? "ถัดไป" : "Next"} <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </div>
          )}


        </CardContent>
      </Card>
    </div>
  );
};

export default FirstLoginSetup;
