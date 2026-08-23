import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { gradeFromBubbles } from "@/lib/examAutoGrade";
import { saveErrorMessage } from "@/lib/saveError";
import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle, Save, RefreshCw } from "lucide-react";

type DetectedAnswers = Record<string, string | null>;
type ExamOption = { id: string; title: string; question_count: number };
type TemplateField = {
  id: string;
  key: string;
  label: string;
  type: string;
  group?: string | null;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

const CHOICES: (string | null)[] = ["A", "B", "C", "D", null];

export default function ExamAutoGradePage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedAnswers>({});
  const [corrected, setCorrected] = useState<DetectedAnswers>({});
  const [detectedFields, setDetectedFields] = useState<TemplateField[]>([]);
  const [studentCode, setStudentCode] = useState<string>("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [grading, setGrading] = useState<{ score: number; total: number; percent: number; detail?: string } | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  // exam selector for saving
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [examQuestions, setExamQuestions] = useState<{ question_no: number; correct_answer: string }[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("exams")
        .select("id,title,question_count")
        .order("created_at", { ascending: false })
        .limit(50);
      if (active && data) setExams(data as ExamOption[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedExamId) {
      setExamQuestions([]);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("exam_questions")
        .select("question_no,correct_answer")
        .eq("exam_id", selectedExamId)
        .order("question_no");
      if (active) setExamQuestions((data as any) || []);
    })();
    return () => {
      active = false;
    };
  }, [selectedExamId]);

  // recompute grading when corrected or examQuestions changes
  useEffect(() => {
    if (Object.keys(corrected).length === 0) {
      setGrading(null);
      return;
    }
    if (examQuestions.length === 0) {
      const total = Object.keys(corrected).length;
      const filled = Object.values(corrected).filter((v) => v != null && v !== "").length;
      setGrading({
        score: filled,
        total,
        percent: total ? Math.round((filled / total) * 100) : 0,
        detail: "ยังไม่เลือกชุดข้อสอบ — นับจำนวนข้อที่เติม",
      });
      return;
    }
    const key: Record<number, string> = {};
    examQuestions.forEach((q) => (key[q.question_no] = q.correct_answer));
    const res = gradeFromBubbles(corrected as any, key as any);
    setGrading(res);
  }, [corrected, examQuestions]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  async function fileToDataUrl(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setDetected({});
    setCorrected({});
    setDetectedFields([]);
    setConfidence(null);
    setProvider(null);
    setGrading(null);

    // auto trigger analyze
    await analyzeFile(f);
  }

  async function analyzeFile(f: File) {
    setLoading(true);
    setError(null);
    try {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      const isImage = f.type.startsWith("image/");

      // === PDF: try analyze-pdf-template via FormData ===
      if (isPdf) {
        // Requirement: upload PDF, call supabase.functions.invoke("analyze-pdf-template", { body: formData })
        const formData = new FormData();
        formData.append("file", f, f.name);
        formData.append("pdf", f, f.name);

        let respData: any = null;
        let respError: any = null;

        try {
          const res: any = await supabase.functions.invoke("analyze-pdf-template", {
            body: formData,
          });
          respData = res.data;
          respError = res.error;
          if (respError) throw respError;
        } catch (invokeErr: any) {
          // Edge function not available or expects JSON with template_id — fallback handling
          const msg = String(invokeErr?.message || "");
          // Try fallback: attempt exam-grade with pdf as base64 image (some sheets are pdf scans)
          // If invokeErr indicates template_id required, show user friendly fallback
          if (/template_id required|template not found|Failed to fetch|functions|404/i.test(msg) || !respData) {
            // Fallback attempt: try exam-grade if pdf can be treated as image (first page not extractable here)
            // Instead surface error with fallback UI and offer to try exam-grade
            // We will attempt exam-grade via base64 anyway for scanned PDF answer sheets
            try {
              const base64 = await fileToDataUrl(f);
              // exam-grade can handle pdf base64? It expects image_base64 — try as image (will likely fail gracefully)
              const qCount =
                (exams.find((x) => x.id === selectedExamId)?.question_count as number) ||
                (examQuestions.length ? examQuestions.length : 20);
              const { data: gradeData, error: gradeErr } = await supabase.functions.invoke("exam-grade", {
                body: {
                  image_base64: base64,
                  question_count: qCount,
                  student_code_digits: 5,
                  choice_format: "abcd",
                },
              });
              if (!gradeErr && gradeData && !gradeData.error) {
                const ans = (gradeData.answers || {}) as DetectedAnswers;
                const code = String(gradeData.student_code || "").replace(/[^0-9]/g, "");
                setDetected(ans);
                setCorrected({ ...ans });
                setStudentCode(code);
                setConfidence(typeof gradeData.confidence === "number" ? gradeData.confidence : null);
                setProvider(gradeData.provider || null);
                toast.success(`ตรวจคำตอบสำเร็จ (fallback exam-grade): ${Object.keys(ans).length} ข้อ`);
                return;
              }
              // if exam-grade also fails, throw original analyze error for UI
              throw invokeErr;
            } catch {
              throw invokeErr;
            }
          }
          throw invokeErr;
        }

        if (respData?.error) throw new Error(respData.error);

        // handle analyze-pdf-template success responses
        if (Array.isArray(respData?.fields)) {
          const fields: TemplateField[] = respData.fields;
          setDetectedFields(fields);
          if (respData.warning) {
            toast.message
              ? (toast as any)(respData.warning)
              : toast.error(respData.warning);
          }
          // Synthesize detected answers if fields look like exam questions (for table display)
          // The template analyzer returns field_map, not OMR answers — show field table and allow manual correction
          // If fields contain question-like keys, prefill corrected for demo
          const qLike = fields.filter((f) => /^(q|question|ข้อ|field_)/i.test(f.key) && (f.type === "radio" || f.type === "checkbox"));
          if (qLike.length > 0 && Object.keys(detected).length === 0) {
            // create placeholder answers map for grading workflow (user will correct)
            const ans: DetectedAnswers = {};
            qLike.slice(0, 100).forEach((_f, idx) => {
              ans[String(idx + 1)] = null;
            });
            setDetected(ans);
            setCorrected({ ...ans });
          }
          toast.success(
            `วิเคราะห์ PDF สำเร็จ: พบ ${respData.fields_count ?? fields.length} ช่อง` +
              (respData.source ? ` (source: ${respData.source})` : "")
          );
          if (fields.length === 0) {
            setError(
              respData.warning ||
                "ไม่พบช่องกรอกใน PDF — ลองอัปโหลดสแกนกระดาษคำตอบที่เป็นรูปภาพแทน หรือใช้โหมดวิเคราะห์ด้วย AI"
            );
          }
          return;
        }

        if (respData?.answers || respData?.detected_answers) {
          const ans = (respData.answers || respData.detected_answers) as DetectedAnswers;
          setDetected(ans);
          setCorrected({ ...ans });
          if (respData.student_code) setStudentCode(String(respData.student_code));
          if (typeof respData.confidence === "number") setConfidence(respData.confidence);
          toast.success("ตรวจคำตอบจาก PDF สำเร็จ");
          return;
        }

        // Generic success
        toast.success("อัปโหลด PDF สำเร็จ — ไม่พบรูปแบบ answers, แสดง field_map");
        return;
      }

      // === Image: call exam-grade ===
      if (isImage) {
        const base64 = await fileToDataUrl(f);
        const qCount =
          (exams.find((x) => x.id === selectedExamId)?.question_count as number) ||
          (examQuestions.length ? examQuestions.length : 20);

        // also try analyze-pdf-template fallback for images? primary is exam-grade
        const { data, error: fnError } = await supabase.functions.invoke("exam-grade", {
          body: {
            image_base64: base64,
            question_count: qCount,
            student_code_digits: 5,
            choice_format: "abcd",
          },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        const ans = (data.answers || {}) as DetectedAnswers;
        const code = String(data.student_code || "").replace(/[^0-9]/g, "");
        setDetected(ans);
        setCorrected({ ...ans });
        setStudentCode(code);
        setConfidence(typeof data.confidence === "number" ? data.confidence : null);
        setProvider(data.provider || null);
        toast.success(`ตรวจเสร็จ: ${Object.keys(ans).length} ข้อ` + (data.confidence != null ? ` ความมั่นใจ ${(data.confidence * 100).toFixed(0)}%` : ""));
        return;
      }

      // Unsupported type
      throw new Error("รองรับเฉพาะไฟล์ PDF และรูปภาพ (JPG/PNG)");
    } catch (e: any) {
      const msg = saveErrorMessage(e, "เรียก Edge Function ไม่สำเร็จ");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      // reset input so same file can be reselected
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleCorrectChange(q: string, val: string | null) {
    setCorrected((prev) => ({ ...prev, [q]: val === "__clear__" ? null : val }));
  }

  async function handleRetry() {
    if (!file) {
      toast.error("กรุณาเลือกไฟล์ก่อน");
      return;
    }
    await analyzeFile(file);
  }

  async function handleSave() {
    if (Object.keys(corrected).length === 0) {
      toast.error("ยังไม่มีผลการตรวจให้บันทึก");
      return;
    }
    if (!selectedExamId) {
      toast.error("กรุณาเลือกชุดข้อสอบก่อนบันทึก (ต้องมี exam_id)");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || null;

      const total = examQuestions.length || Object.keys(corrected).length;
      let score = 0;
      const correctMap: Record<string, boolean> = {};
      if (examQuestions.length > 0) {
        examQuestions.forEach((q) => {
          const ans = corrected[String(q.question_no)];
          const ok = ans != null && String(ans).toUpperCase() === String(q.correct_answer).toUpperCase();
          correctMap[String(q.question_no)] = !!ok;
          if (ok) score++;
        });
      } else {
        // no answer key — just count filled as score for demo
        score = Object.values(corrected).filter((v) => v != null && v !== "").length;
        Object.keys(corrected).forEach((k) => (correctMap[k] = corrected[k] != null));
      }
      const pct = total ? (score / total) * 100 : 0;

      // lookup student by code
      let studentId: string | null = null;
      let studentName: string | null = null;
      const codeClean = String(studentCode || "").replace(/[^0-9]/g, "");
      if (codeClean) {
        const { data: stu } = await supabase
          .from("students")
          .select("id,prefix,first_name,last_name")
          .eq("student_code", codeClean)
          .maybeSingle();
        if (stu) {
          studentId = (stu as any).id;
          studentName = `${(stu as any).prefix || ""}${(stu as any).first_name} ${(stu as any).last_name}`.trim();
        }
      }

      const payload: any = {
        exam_id: selectedExamId,
        student_id: studentId,
        student_code_detected: codeClean || null,
        student_name_snapshot: studentName,
        answers: corrected,
        correct_map: correctMap,
        score,
        total,
        percentage: pct,
        graded_by: userId,
      };

      // Try to avoid duplicate: if same exam + code exists, update instead of insert (parity with ExamScanPage)
      if (codeClean) {
        const { data: existing } = await supabase
          .from("exam_submissions")
          .select("id")
          .eq("exam_id", selectedExamId)
          .eq("student_code_detected", codeClean)
          .maybeSingle();
        if ((existing as any)?.id) {
          const { error: updErr } = await supabase.from("exam_submissions").update(payload).eq("id", (existing as any).id);
          if (updErr) throw updErr;
          toast.success(`อัปเดตผลสอบแล้ว: ${score}/${total} (${pct.toFixed(1)}%)`);
          return;
        }
      }

      const { error } = await supabase.from("exam_submissions").insert(payload);
      if (error) throw error;
      toast.success(`บันทึกผลแล้ว: ${score}/${total} (${pct.toFixed(1)}%)`);
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const hasResult = Object.keys(detected).length > 0 || detectedFields.length > 0;
  const sortedQs = Object.keys(corrected)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map(String);

  // For manual add row
  const [nextQ, setNextQ] = useState<string>("");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold">AI ตรวจข้อสอบ — สแกนกระดาษคำตอบ</h1>
        <p className="text-sm text-muted-foreground">
          อัปโหลด PDF กระดาษคำตอบ หรือรูปถ่ายกระดาษฝนวงกลม ระบบจะเรียก <code>analyze-pdf-template</code> / <code>exam-grade</code> เพื่อตรวจอัตโนมัติ แล้วแก้ไขได้ก่อนบันทึก
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            อัปโหลด PDF กระดาษคำตอบ
          </CardTitle>
          <CardDescription>
            รองรับไฟล์ PDF สแกน และรูปภาพ JPG/PNG — ระบบจะอัปโหลด PDF แล้วเรียก <code>supabase.functions.invoke("analyze-pdf-template", {"{ body: formData }"} )</code> อัตโนมัติ
            หากไม่พร้อมใช้งาน จะใช้ <code>exam-grade</code> เป็น fallback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium">เลือกชุดข้อสอบ (สำหรับบันทึกคะแนน)</label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="-- เลือกชุดข้อสอบ --" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.title} ({ex.question_count} ข้อ)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedExamId && examQuestions.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">โหลดเฉลย {examQuestions.length} ข้อแล้ว</p>
              )}
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">รหัสนักเรียนที่ตรวจพบ</label>
              <Input
                className="mt-1"
                placeholder="เช่น 12345"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          </div>

          <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3 bg-muted/20">
            <Input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              capture="environment"
              onChange={handleFileChange}
              disabled={loading}
              className="max-w-md mx-auto"
            />
            <p className="text-xs text-muted-foreground">ลากไฟล์มาวางหรือคลิกเพื่อเลือก — PDF จะเรียก analyze-pdf-template, รูปภาพจะเรียก exam-grade</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => fileRef.current?.click()} disabled={loading} variant="outline">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                เลือกไฟล์
              </Button>
              {file && (
                <Button onClick={handleRetry} disabled={loading} variant="secondary">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  วิเคราะห์ใหม่
                </Button>
              )}
            </div>
            {file && (
              <p className="text-xs">
                ไฟล์ปัจจุบัน: <span className="font-mono">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
            {previewUrl && (
              <img src={previewUrl} alt="preview" className="mx-auto max-h-64 rounded border mt-2 object-contain" />
            )}
            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> กำลังเรียก analyze-pdf-template...
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive text-left">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {grading && (
            <div
              className={`p-3 rounded flex items-center gap-2 ${grading.percent >= 50 ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <div className="flex-1">
                <div className="font-semibold">
                  คะแนน {grading.score}/{grading.total} ({grading.percent}%){grading.detail ? ` · ${grading.detail}` : ""}
                </div>
                {confidence != null && (
                  <div className="text-xs opacity-80">
                    ความมั่นใจ AI: {(confidence * 100).toFixed(0)}%{provider ? ` · ${provider}` : ""}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {detectedFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ผลวิเคราะห์เทมเพลต (analyze-pdf-template)</CardTitle>
            <CardDescription>พบ {detectedFields.length} ช่อง — แก้ไขคำตอบด้านล่างแล้วกดบันทึก</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-72 border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>key</TableHead>
                    <TableHead>label</TableHead>
                    <TableHead>type</TableHead>
                    <TableHead>group</TableHead>
                    <TableHead>page</TableHead>
                    <TableHead>bbox</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detectedFields.slice(0, 100).map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">{f.key}</TableCell>
                      <TableCell className="text-xs">{f.label}</TableCell>
                      <TableCell className="text-xs">{f.type}</TableCell>
                      <TableCell className="text-xs">{f.group || "-"}</TableCell>
                      <TableCell className="text-xs">{f.page}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {f.x.toFixed(2)},{f.y.toFixed(2)},{f.w.toFixed(2)},{f.h.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {detectedFields.length > 100 && (
              <p className="text-xs text-muted-foreground mt-2">แสดง 100 จาก {detectedFields.length} ช่อง</p>
            )}
          </CardContent>
        </Card>
      )}

      {hasResult && sortedQs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>ผลการตรวจ — แก้ไขได้ก่อนบันทึก</span>
              <span className="text-sm font-normal text-muted-foreground">{sortedQs.length} ข้อ</span>
            </CardTitle>
            <CardDescription>
              คอลัมน์ “AI ตรวจพบ” คือค่าจาก Edge Function — แก้ไขคอลัมน์ “แก้ไข” แล้วกดบันทึก ระบบจะคำนวณคะแนนใหม่ด้วย <code>gradeFromBubbles</code> และบันทึกผ่าน{" "}
              <code>exam_submissions</code> (หรือเรียก <code>exam-grade</code> ซ้ำเมื่อจำเป็น)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">ข้อ</TableHead>
                    <TableHead className="text-center">AI ตรวจพบ</TableHead>
                    <TableHead className="text-center">แก้ไข (manual)</TableHead>
                    <TableHead className="text-center">เฉลย</TableHead>
                    <TableHead className="text-center">ผล</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedQs.map((q) => {
                    const det = detected[q];
                    const cur = corrected[q];
                    const keyAns = examQuestions.find((x) => String(x.question_no) === q)?.correct_answer || "-";
                    const ok = cur != null && keyAns !== "-" ? String(cur).toUpperCase() === String(keyAns).toUpperCase() : null;
                    return (
                      <TableRow key={q}>
                        <TableCell className="text-center font-mono">{q}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${det == null ? "bg-muted text-muted-foreground" : "bg-blue-50 text-blue-700 border border-blue-200"}`}
                          >
                            {det ?? "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Select
                            value={cur ?? "__clear__"}
                            onValueChange={(v) => handleCorrectChange(q, v === "__clear__" ? null : v)}
                          >
                            <SelectTrigger className="w-24 mx-auto h-8">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__clear__">-</SelectItem>
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="B">B</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="D">D</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">{keyAns}</TableCell>
                        <TableCell className="text-center">
                          {ok == null ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : ok ? (
                            <span className="text-green-600 font-bold">✓</span>
                          ) : (
                            <span className="text-destructive font-bold">✗</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="เพิ่มข้อ เช่น 21"
                  value={nextQ}
                  onChange={(e) => setNextQ(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-28 h-9"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const n = nextQ.trim();
                    if (!n) return;
                    if (corrected[n] !== undefined) {
                      toast.error(`ข้อ ${n} มีอยู่แล้ว`);
                      return;
                    }
                    setCorrected((p) => ({ ...p, [n]: null }));
                    setDetected((p) => ({ ...p, [n]: null }));
                    setNextQ("");
                  }}
                >
                  เพิ่มข้อ
                </Button>
              </div>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCorrected({ ...detected });
                    toast.success("รีเซ็ตค่าแก้ไขตาม AI");
                  }}
                >
                  รีเซ็ต
                </Button>
                <Button onClick={handleSave} disabled={saving || loading}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  บันทึกคะแนน
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasResult && !loading && !error && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            ยังไม่มีผลการตรวจ — อัปโหลด PDF กระดาษคำตอบ หรือรูปถ่ายกระดาษฝนวงกลมเพื่อเริ่มตรวจ
          </CardContent>
        </Card>
      )}
    </div>
  );
}
