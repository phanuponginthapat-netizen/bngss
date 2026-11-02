import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { saveErrorMessage } from "@/lib/saveError";
import { Camera, Upload, Loader2, CheckCircle2, X } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { gradeAnswers, answerKeyProblem, cleanStudentCode } from "@/lib/examGrading";
import { resolveStorageUrl } from "@/lib/storageUrl";

export default function ExamScanPage() {
  const { id } = useParams();
  const { user } = useAuthSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [result, setResult] = useState<any>(null);


  const { data: exam } = useQuery({
    queryKey: ["exam", id],
    enabled: !!id,
    queryFn: async () => { const r = await supabase.from("exams").select("*").eq("id", id).maybeSingle(); if (r.error) throw r.error; return r.data; },
  });
  const { data: questions = [] } = useQuery({
    queryKey: ["exam-q", id],
    enabled: !!id,
    queryFn: async () => { const r = await supabase.from("exam_questions").select("question_no,correct_answer").eq("exam_id", id).order("question_no"); if (r.error) throw r.error; return r.data || []; },
  });
  const { data: sheet } = useQuery({
    queryKey: ["exam-sheet", id],
    enabled: !!id,
    queryFn: async () => { const r = await supabase.from("exam_sheets").select("*").eq("exam_id", id).maybeSingle(); if (r.error) throw r.error; return r.data; },
  });

  async function handleFile(file: File) {
    if (!exam || !user) return;
    const keyProblem = answerKeyProblem(questions as any[], Number(exam.question_count) || 0);
    if (keyProblem) { toast.error(`ตรวจไม่ได้: ${keyProblem}`); return; }
    setBusy(true);
    setResult(null);
    try {
      // ย่อรูปก่อนส่ง (เร็วขึ้น และไม่เกินขนาดที่ AI รับได้)
      const dataUrl = await downscaleImage(file, 1800);
      const digits = sheet?.student_code_digits || 5;

      const stamp = Date.now();
      const scanPath = sanitizeStorageKey(`${exam.id}/${stamp}-scan.jpg`);
      const scanBlob = await (await fetch(dataUrl)).blob();
      const up = await supabase.storage.from("exam-scans").upload(scanPath, scanBlob, { upsert: false, contentType: "image/jpeg" });
      if (up.error) throw up.error;

      const layout = (sheet?.layout_config as any) || {};
      const choiceFormat = (["abcd", "1234", "thai"] as const).includes(layout.choice_format)
        ? layout.choice_format as "abcd" | "1234" | "thai"
        : "abcd";
      const { data, error } = await supabase.functions.invoke("exam-grade", {
        body: { image_base64: dataUrl, question_count: exam.question_count, student_code_digits: digits, choice_format: choiceFormat },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const answers: Record<string, string | null> = data.answers || {};
      const g = gradeAnswers(questions as any[], answers);
      const { score, total, correctMap } = g;

      const labels = choiceFormat === "1234" ? ["1","2","3","4"] : choiceFormat === "thai" ? ["ก","ข","ค","ง"] : ["A","B","C","D"];
      const graded = await renderGradedOverlay(dataUrl, answers, correctMap, questions as any[], labels);
      const gradedBlob = await (await fetch(graded)).blob();
      const gradedPath = `${exam.id}/${stamp}-graded.jpg`;
      const gradedUp = await supabase.storage.from("exam-scans").upload(gradedPath, gradedBlob, { upsert: false, contentType: "image/jpeg" });
      if (gradedUp.error) throw gradedUp.error;

      const studentCode = cleanStudentCode(data.student_code, digits);

      let studentId: string | null = null;
      let studentName = "";
      if (studentCode) {
        const { data: stu, error: stuErr } = await supabase.from("students").select("id,prefix,first_name,last_name")
          .eq("student_code", studentCode).limit(2);
        if (stuErr) throw stuErr;
        if (stu && stu.length === 1) {
          studentId = stu[0].id;
          studentName = `${stu[0].prefix || ""}${stu[0].first_name} ${stu[0].last_name}`;
        }
      }

      const subPayload: any = {
        exam_id: exam.id,
        student_id: studentId,
        student_code_detected: studentCode,
        student_name_snapshot: studentName,
        scan_image_url: scanPath,
        graded_image_url: gradedPath,
        answers,
        correct_map: correctMap,
        score, total, percentage: g.percentage,
        graded_by: user.id,
      };
      // สแกนซ้ำรหัสเดิมในข้อสอบเดิม → อัปเดตแทนเพิ่มแถวใหม่ (ไม่มีรหัส = เพิ่มใหม่ให้ครูตรวจเอง)
      let existingId: string | null = null;
      if (studentCode) {
        const { data: existing, error: dupErr } = await supabase.from("exam_submissions").select("id")
          .eq("exam_id", exam.id).eq("student_code_detected", studentCode).limit(1);
        if (dupErr) throw dupErr;
        existingId = existing?.[0]?.id ?? null;
      }
      const { error: subErr } = existingId
        ? await supabase.from("exam_submissions").update(subPayload).eq("id", existingId)
        : await supabase.from("exam_submissions").insert(subPayload);
      if (subErr) { toast.error(saveErrorMessage(subErr)); return; }

      const gradedUrl = await resolveStorageUrl("exam-scans", gradedPath);
      setResult({ score, total, pct: g.percentage, blank: g.blank, studentCode, studentName, gradedUrl, confidence: data.confidence ?? null, updated: !!existingId });
      if (!studentCode) toast.warning(`ตรวจแล้ว ${score}/${total} แต่อ่านรหัสนักเรียนไม่ครบ — โปรดตรวจสอบในหน้าผลคะแนน`);
      else if (!studentId) toast.warning(`ตรวจแล้ว ${score}/${total} แต่ไม่พบนักเรียนรหัส ${studentCode}`);
      else toast.success(`ตรวจเสร็จ: ${score}/${total} (${g.percentage.toFixed(1)}%)${existingId ? " — แทนผลเดิม" : ""}`);
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold">ตรวจกระดาษคำตอบ</h1>
      <p className="text-sm text-muted-foreground">{exam?.title}</p>

      <Card className="p-6 space-y-4 text-center">
        <p className="text-sm">ถ่ายภาพหรืออัปโหลดรูปกระดาษคำตอบ — ระบบจะตรวจอัตโนมัติด้วย AI</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <Button onClick={() => setCamOpen(true)} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Camera className="w-4 h-4 mr-2"/>} ถ่ายภาพ
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="w-4 h-4 mr-2"/> อัปโหลด
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">เคล็ดลับ: วางกระดาษให้จุดดำ 4 มุมอยู่ในกรอบเขียว แสงพอ และไม่เอียง</p>
      </Card>

      <CameraDialog open={camOpen} onClose={() => setCamOpen(false)} onCapture={(f) => handleFile(f)} busy={busy} lastResult={result} />


      {result && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-6 h-6"/>
            <h2 className="text-xl font-bold">{result.score} / {result.total} ({result.pct.toFixed(1)}%)</h2>
          </div>
          <p className="text-sm">รหัสนักเรียน: <strong>{result.studentCode || "ไม่พบ"}</strong> {result.studentName && `· ${result.studentName}`}
            {result.confidence != null && (
              <span className={`ml-2 text-xs ${result.confidence >= 0.8 ? "text-green-600" : result.confidence >= 0.6 ? "text-amber-600" : "text-red-600"}`}>
                ความมั่นใจ: {(result.confidence * 100).toFixed(0)}%
              </span>
            )}
          </p>
          {result.blank > 0 && <p className="text-sm text-warning">มี {result.blank} ข้อที่ไม่ได้ฝนหรือฝนมากกว่า 1 ช่อง (นับเป็นผิด)</p>}
          {result.gradedUrl && <img src={result.gradedUrl} alt="ผลการตรวจ" className="w-full rounded border" />}
        </Card>
      )}
    </div>
  );
}

function CameraDialog({ open, onClose, onCapture, busy, lastResult }: { open: boolean; onClose: () => void; onCapture: (f: File) => void; busy?: boolean; lastResult?: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string>("");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setReady(false); setErr("");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("เบราว์เซอร์นี้ไม่รองรับกล้อง (ต้องใช้ HTTPS และ Safari 11+ บน iOS)");
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = s;
        try { const { applyCameraFocus } = await import("@/lib/cameraFocus"); await applyCameraFocus(s, "close"); } catch {}
        const v = videoRef.current;
        if (v) {
          v.setAttribute("playsinline", "true");
          v.setAttribute("webkit-playsinline", "true");
          v.muted = true;
          (v as any).srcObject = s;
          await new Promise<void>((resolve) => {
            if (v.readyState >= 1) return resolve();
            v.onloadedmetadata = () => resolve();
          });
          try { await v.play(); } catch { /* iOS may need user gesture; video still renders */ }
          setReady(true);
        }
      } catch (e: any) { setErr(e?.message || "ไม่สามารถเปิดกล้องได้"); }
    })();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, [open]);

  function snap() {
    const v = videoRef.current; if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const handle = (b: Blob | null) => {
      if (!b) return;
      onCapture(new File([b], `scan-${Date.now()}.jpg`, { type: "image/jpeg" }));
      setCount((n) => n + 1);
    };
    if (c.toBlob) {
      c.toBlob(handle, "image/jpeg", 0.95);
    } else {
      // iOS Safari fallback
      const dataUrl = c.toDataURL("image/jpeg", 0.95);
      fetch(dataUrl).then(r => r.blob()).then(handle);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>ถ่ายภาพกระดาษคำตอบ (โหมดต่อเนื่อง){count > 0 ? ` · ตรวจแล้ว ${count}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="relative bg-black w-full" style={{ paddingBottom: `${(194 / 140.5) * 100}%` }}>
          <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-contain" />

          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-[2%] border-2 border-green-400 rounded-md">
              {[
                "top-0 left-0 border-t-4 border-l-4",
                "top-0 right-0 border-t-4 border-r-4",
                "bottom-0 left-0 border-b-4 border-l-4",
                "bottom-0 right-0 border-b-4 border-r-4",
              ].map((p, i) => (
                <div key={i} className={`absolute w-8 h-8 border-green-300 ${p}`} />
              ))}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-green-300 text-xs whitespace-nowrap bg-black/60 px-2 py-0.5 rounded">
                จัดให้จุดดำ 4 มุมพอดีกับกรอบ
              </div>
            </div>
          </div>
          {!ready && !err && <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="w-6 h-6 animate-spin" /></div>}
          {err && <div className="absolute inset-0 flex items-center justify-center text-white text-sm p-4 text-center">{err}</div>}
          {busy && (
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> กำลังตรวจ...
            </div>
          )}
          {lastResult && !busy && (
            <div className="absolute top-2 left-2 bg-green-600/90 text-white text-xs px-2 py-1 rounded">
              ล่าสุด: {lastResult.score}/{lastResult.total} {lastResult.studentCode ? `· ${lastResult.studentCode}` : ""}
            </div>
          )}
        </div>
        <div className="p-4 flex gap-2 justify-between">
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" />ปิด</Button>
          <Button onClick={snap} disabled={!ready || busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Camera className="w-4 h-4 mr-1" />}
            ถ่ายแผ่นถัดไป
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function renderGradedOverlay(
  dataUrl: string,
  answers: Record<string, string | null>,
  correctMap: Record<string, boolean>,
  questions: any[],
  labels: string[] = ["A", "B", "C", "D"],
): Promise<string> {
  const show = (v: string | null | undefined) => { const i = ["A","B","C","D"].indexOf(String(v ?? "").toUpperCase()); return i >= 0 ? labels[i] : "-"; };
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = dataUrl; });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  // Draw summary banner top-right
  const padding = 16;
  ctx.font = `bold ${Math.floor(img.naturalHeight * 0.025)}px sans-serif`;
  const correct = Object.values(correctMap).filter(Boolean).length;
  const total = questions.length;
  const text = `${correct}/${total}`;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(34,197,94,0.9)";
  ctx.fillRect(canvas.width - tw - padding * 3, padding, tw + padding * 2, padding * 2.5);
  ctx.fillStyle = "white";
  ctx.fillText(text, canvas.width - tw - padding * 2, padding * 2.2);

  // List right side with green/red checks per question — 2 columns when many rows
  const lineH = Math.max(18, Math.floor(canvas.height * 0.018));
  ctx.font = `${Math.floor(lineH * 0.7)}px monospace`;
  const rowLabels = questions.map((q) => {
    const ok = correctMap[String(q.question_no)];
    const ans = show(answers[String(q.question_no)]);
    const label = `${ok ? "✓" : "✗"} ${q.question_no}. ${ans}${ok ? "" : ` (${show(q.correct_answer)})`}`;
    const lw = ctx.measureText(label).width;
    return { ok, label, lw };
  });
  const padCol = 8;
  const maxRightW = Math.min(canvas.width * 0.42, Math.max(...rowLabels.map((r) => r.lw)) + padding * 2 + padCol);
  const cols = rowLabels.length > Math.floor(canvas.height / lineH) ? 2 : 1;
  const startX = canvas.width - maxRightW;
  rowLabels.forEach((row, i) => {
    const col = cols === 2 && i >= Math.ceil(rowLabels.length / 2) ? 1 : 0;
    const rowInCol = cols === 2 ? (col === 0 ? i : i - Math.ceil(rowLabels.length / 2)) : i;
    const x = startX + col * (maxRightW / cols);
    const y = padding * 4 + rowInCol * lineH;
    if (y + lineH > canvas.height - padding) return;
    ctx.fillStyle = row.ok ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)";
    ctx.fillRect(x, y, Math.min(row.lw + padding, maxRightW / cols - padCol), lineH);
    ctx.fillStyle = "white";
    ctx.fillText(row.label, x + padCol, y + lineH * 0.75);
  });

  return canvas.toDataURL("image/jpeg", 0.85);
}

async function downscaleImage(file: File, maxSide: number): Promise<string> {
  const src = await fileToDataUrl(file);
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = src; });
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}
