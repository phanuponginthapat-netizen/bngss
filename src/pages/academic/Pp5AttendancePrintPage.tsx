import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, FileDown } from "lucide-react";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

/**
 * พิมพ์ "เวลาเรียน" ตามแบบฟอร์ม ปพ.5 (sheet: เวลาเรียน)
 * Layout เป๊ะตามไฟล์ตัวอย่าง .xls — กรอกเดือน/วันที่ และเครื่องหมายมาเรียน (✓) ได้
 * บันทึกอัตโนมัติใน localStorage ตาม assignmentId
 */

const DEFAULT_NUM_COLS = 20; // จำนวนคาบเริ่มต้น (ปรับได้ในหน้าจอ)
const MIN_COLS = 5;
const MAX_COLS = 80;
const COLS_PER_PRINT_PAGE = 20; // คอลัมน์วันที่ต่อ 1 หน้ากระดาษ (เพื่อรวมเป็นเล่ม)
const ROWS_PER_PRINT_PAGE = 25;
const MONTHS = ["พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย."];

type DayHeader = { month: string; day: string };
type SavedState = {
  credits: string;
  totalHours: string;
  eightyHours: string;
  hoursTaught: string;
  academicYear: string;
  headers: DayHeader[];
  marks: Record<string, string[]>; // studentId -> array of marks per col ("" | "✓" | "ล" | "ป" | "ส")
};

const Pp5AttendancePrintPage = ({ assignmentId: assignmentIdProp }: { assignmentId?: string } = {}) => {
  const params = useParams();
  const assignmentId = assignmentIdProp ?? params.assignmentId;
  const schoolInfo = useSchoolInfo();
  const storageKey = `pp5-attendance:${assignmentId}`;

  const { data: assignment } = useQuery({
    queryKey: ["assignment_for_attendance", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("teacher_assignments")
        .select("*, personnel(*), subjects(*), classrooms(*)")
        .eq("id", assignmentId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students_for_attendance_print", assignment?.classroom_id],
    enabled: !!assignment?.classroom_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name")
        .eq("classroom_id", assignment!.classroom_id)
        .eq("status", "active")
        .order("student_code");
      return data || [];
    },
  });

  const subj: any = assignment?.subjects || {};
  const cls: any = assignment?.classrooms || {};
  const per: any = assignment?.personnel || {};

  const defaultState: SavedState = useMemo(
    () => ({
      credits: subj.credits ? String(subj.credits) : "",
      totalHours: "40",
      eightyHours: "32",
      hoursTaught: String(DEFAULT_NUM_COLS),
      academicYear: String(assignment?.academic_year || ""),
      headers: Array.from({ length: DEFAULT_NUM_COLS }, () => ({ month: "", day: "" })),
      marks: {},
    }),
    [subj.credits, assignment?.academic_year]
  );

  const [state, setState] = useState<SavedState>(defaultState);

  // Load from localStorage when assignment loaded
  useEffect(() => {
    if (!assignmentId) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migration: ถ้าข้อมูลเก่าเก็บ headers ไว้เยอะเกิน ให้ตัดเหลือ DEFAULT_NUM_COLS
        if (Array.isArray(parsed.headers) && parsed.headers.length > DEFAULT_NUM_COLS) {
          parsed.headers = parsed.headers.slice(0, DEFAULT_NUM_COLS);
          if (parsed.marks && typeof parsed.marks === "object") {
            for (const k of Object.keys(parsed.marks)) {
              if (Array.isArray(parsed.marks[k])) {
                parsed.marks[k] = parsed.marks[k].slice(0, DEFAULT_NUM_COLS);
              }
            }
          }
        }
        setState((prev) => ({ ...defaultState, ...prev, ...parsed }));
      } else {
        setState(defaultState);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, defaultState.academicYear]);

  // Persist
  useEffect(() => {
    if (!assignmentId) return;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, assignmentId, storageKey]);

  const updateHeader = (i: number, key: "month" | "day", val: string) => {
    setState((s) => {
      const headers = [...s.headers];
      headers[i] = { ...headers[i], [key]: val };
      return { ...s, headers };
    });
  };

  const cycleMark = (sid: string, col: number) => {
    const cycle = ["", "✓", "ล", "ป", "ส"];
    setState((s) => {
      const n = s.headers.length;
      const arr = s.marks[sid] ? [...s.marks[sid]] : Array(n).fill("");
      while (arr.length < n) arr.push("");
      const cur = arr[col] || "";
      const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
      arr[col] = next;
      return { ...s, marks: { ...s.marks, [sid]: arr } };
    });
  };

  const setMark = (sid: string, col: number, val: string) => {
    setState((s) => {
      const n = s.headers.length;
      const arr = s.marks[sid] ? [...s.marks[sid]] : Array(n).fill("");
      while (arr.length < n) arr.push("");
      arr[col] = val;
      return { ...s, marks: { ...s.marks, [sid]: arr } };
    });
  };

  const setNumCols = (n: number) => {
    const clamped = Math.max(MIN_COLS, Math.min(MAX_COLS, n));
    setState((s) => {
      const headers = [...s.headers];
      while (headers.length < clamped) headers.push({ month: "", day: "" });
      headers.length = clamped;
      const marks: Record<string, string[]> = {};
      Object.entries(s.marks).forEach(([k, arr]) => {
        const a = [...arr];
        while (a.length < clamped) a.push("");
        a.length = clamped;
        marks[k] = a;
      });
      return { ...s, headers, marks };
    });
  };

  // เติมทุกช่องของนักเรียนทุกคน (เฉพาะช่องว่าง หรือทับทั้งหมด)
  const fillAll = (val: string, onlyEmpty = true) => {
    setState((s) => {
      const n = s.headers.length;
      const marks: Record<string, string[]> = { ...s.marks };
      (students as any[]).forEach((st) => {
        const arr = marks[st.id] ? [...marks[st.id]] : Array(n).fill("");
        while (arr.length < n) arr.push("");
        for (let i = 0; i < n; i++) {
          if (!onlyEmpty || !arr[i]) arr[i] = val;
        }
        marks[st.id] = arr;
      });
      return { ...s, marks };
    });
  };

  // เติมทั้งแถวของนักเรียนคนเดียว
  const fillRow = (sid: string, val: string, onlyEmpty = true) => {
    setState((s) => {
      const n = s.headers.length;
      const arr = s.marks[sid] ? [...s.marks[sid]] : Array(n).fill("");
      while (arr.length < n) arr.push("");
      for (let i = 0; i < n; i++) {
        if (!onlyEmpty || !arr[i]) arr[i] = val;
      }
      return { ...s, marks: { ...s.marks, [sid]: arr } };
    });
  };

  // เติมทั้งคอลัมน์ (คาบเดียว) ของนักเรียนทุกคน
  const fillCol = (col: number, val: string, onlyEmpty = true) => {
    setState((s) => {
      const n = s.headers.length;
      const marks: Record<string, string[]> = { ...s.marks };
      (students as any[]).forEach((st) => {
        const arr = marks[st.id] ? [...marks[st.id]] : Array(n).fill("");
        while (arr.length < n) arr.push("");
        if (!onlyEmpty || !arr[col]) arr[col] = val;
        marks[st.id] = arr;
      });
      return { ...s, marks };
    });
  };

  const clearAll = () => {
    if (!confirm("ล้างเครื่องหมายทั้งหมด?")) return;
    setState((s) => ({ ...s, marks: {} }));
  };

  const [importing, setImporting] = useState(false);
  const importFromAttendance = async () => {
    if (!assignment?.subject_id || !assignment?.classroom_id) {
      toast.error("ยังไม่มีข้อมูลรายวิชา/ห้องเรียน");
      return;
    }
    if (!students.length) {
      toast.error("ยังไม่มีนักเรียนในห้อง");
      return;
    }
    setImporting(true);
    try {
      const studentIds = (students as any[]).map((s) => s.id);
      let q = supabase
        .from("attendance")
        .select("student_id, attendance_date, status")
        .eq("subject_id", assignment.subject_id)
        .in("student_id", studentIds);
      if (assignment.semester) q = q.eq("semester", assignment.semester);
      if (assignment.academic_year) q = q.eq("academic_year", assignment.academic_year);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) {
        toast.error("ไม่พบข้อมูลเช็คชื่อรายคาบของวิชานี้");
        return;
      }
      const dates = Array.from(new Set(rows.map((r: any) => r.attendance_date))).sort();
      const dateIdx = new Map(dates.map((d, i) => [d, i]));
      const statusMap: Record<string, string> = {
        present: "✓", late: "✓", leave: "ล", sick: "ป", absent: "ส",
      };
      const headers: DayHeader[] = dates.map((d) => {
        const dt = new Date(d);
        return { month: MONTHS[(dt.getMonth() + 12 - 4) % 12], day: String(dt.getDate()) };
      });
      const marks: Record<string, string[]> = {};
      (students as any[]).forEach((st) => { marks[st.id] = Array(dates.length).fill(""); });
      rows.forEach((r: any) => {
        const ci = dateIdx.get(r.attendance_date);
        if (ci === undefined) return;
        if (!marks[r.student_id]) marks[r.student_id] = Array(dates.length).fill("");
        marks[r.student_id][ci] = statusMap[r.status] || "";
      });
      setState((s) => ({ ...s, headers, marks, hoursTaught: String(dates.length) }));
      toast.success(`ดึงข้อมูล ${dates.length} คาบจากเช็คชื่อรายคาบสำเร็จ`);
    } catch (e: any) {
      console.error(e);
      toast.error("ดึงข้อมูลไม่สำเร็จ: " + (e?.message || ""));
    } finally {
      setImporting(false);
    }
  };

  const sheetRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const buildPageHtml = (rowStart: number, rowEnd: number, colStart: number, colEnd: number, pageNo: number, totalPages: number) => {
    const headers = state.headers.slice(colStart, colEnd);
    const monthSpansLocal: { month: string; span: number }[] = [];
    for (const h of headers) {
      const m = h.month || "";
      if (monthSpansLocal.length === 0 || monthSpansLocal[monthSpansLocal.length - 1].month !== m) {
        monthSpansLocal.push({ month: m, span: 1 });
      } else {
        monthSpansLocal[monthSpansLocal.length - 1].span += 1;
      }
    }
    const studentSlice = (students as any[]).slice(rowStart, rowEnd);
    const isLastColPage = colEnd >= state.headers.length;

    const colWidthCalc = `calc((100% - 189px${isLastColPage ? " - 64px" : ""}) / ${headers.length})`;

    const monthHeaderHtml = monthSpansLocal
      .map((m) => `<th colspan="${m.span}">${m.month || ""}</th>`)
      .join("");
    const monthRowHtml = headers.map((h) => `<th>${h.month || ""}</th>`).join("");
    const dayRowHtml = headers.map((h) => `<th>${h.day || ""}</th>`).join("");

    const bodyRows = studentSlice
      .map((st: any, idx: number) => {
        const realIdx = rowStart + idx;
        const marksArr = state.marks[st.id] || [];
        const cells = headers
          .map((_, ci) => `<td class="mark-cell">${marksArr[colStart + ci] || ""}</td>`)
          .join("");
        const present = marksArr.filter((m) => m === "✓" || m === "ป").length;
        const pct = state.hoursTaught ? Math.round((present / Number(state.hoursTaught)) * 100) : 0;
        const tail = isLastColPage ? `<td>${present}</td><td>${pct}</td>` : "";
        return `<tr>
          <td>${realIdx + 1}</td>
          <td>${st.student_code}</td>
          <td class="name-col">${st.prefix || ""}${st.first_name} ${st.last_name}</td>
          ${cells}
          ${tail}
        </tr>`;
      })
      .join("");

    const colgroup = `
      <col style="width:22px" />
      <col style="width:52px" />
      <col style="width:115px" />
      ${headers.map(() => `<col style="width:${colWidthCalc}" />`).join("")}
      ${isLastColPage ? '<col style="width:32px" /><col style="width:32px" />' : ""}
    `;

    return `
      <div class="att-sheet" style="width:297mm; min-height:200mm; padding:8mm; background:#fff; font-family:'TH Sarabun New','Sarabun',serif; color:#000;">
        <div style="font-size:13px; text-align:center; font-weight:600; margin-bottom:2px;">
          เวลาเรียน&nbsp;&nbsp;ชื่อรายวิชา <span style="border-bottom:1px dotted #555; padding:0 4px;">${subj.name_th || ""}</span>
          &nbsp;รหัสวิชา <span style="border-bottom:1px dotted #555; padding:0 4px;">${subj.code || ""}</span>
          &nbsp;ชั้น/ห้อง <span style="border-bottom:1px dotted #555; padding:0 4px;">${cls.grade_level || ""}${cls.section ? "/" + cls.section : ""}</span>
        </div>
        <div style="font-size:13px; margin-bottom:4px;">
          จำนวน <span style="border-bottom:1px dotted #555; padding:0 4px;">${state.credits}</span> หน่วยกิต
          &nbsp;จำนวนชั่วโมงที่เรียนเต็ม <span style="border-bottom:1px dotted #555; padding:0 4px;">${state.totalHours}</span> ชั่วโมง
          &nbsp;เวลาเรียนร้อยละ 80 คิดเป็น <span style="border-bottom:1px dotted #555; padding:0 4px;">${state.eightyHours}</span> ชั่วโมง
          &nbsp;&nbsp;ภาคเรียนที่ ${assignment?.semester || ""} ปีการศึกษา ${state.academicYear}
          &nbsp;&nbsp;ครูผู้สอน: ${per.prefix || ""}${per.first_name || ""} ${per.last_name || ""}
        </div>
        <table style="border-collapse:collapse; width:100%; table-layout:fixed; font-size:10px;">
          <colgroup>${colgroup}</colgroup>
          <thead>
            <tr>
              <th rowspan="3" style="border:1px solid #000; padding:1px;">เลข<br/>ที่</th>
              <th rowspan="3" style="border:1px solid #000; padding:1px;">เลข<br/>ประจำตัว</th>
              <th rowspan="3" style="border:1px solid #000; padding:1px;">ชื่อ - สกุล</th>
              ${monthHeaderHtml}
              ${isLastColPage ? '<th rowspan="3" style="border:1px solid #000;">รวม</th><th rowspan="3" style="border:1px solid #000;">ร้อยละ</th>' : ""}
            </tr>
            <tr>${monthRowHtml}</tr>
            <tr>${dayRowHtml}</tr>
          </thead>
          <tbody>${bodyRows || `<tr><td colspan="${headers.length + (isLastColPage ? 5 : 3)}" style="padding:8px; text-align:center;">ไม่มีข้อมูลนักเรียน</td></tr>`}</tbody>
        </table>
        <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:11px;">
          <div>หมายเหตุ: ✓ = มาเรียน, ล = ลา, ป = ป่วย, ส = ขาด</div>
          <div>หน้า ${pageNo} / ${totalPages}</div>
        </div>
      </div>
    `;
  };

  const exportPdf = async () => {
    setExporting(true);
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0";
    container.style.background = "#fff";
    // Style for table cells inside built pages
    const styleTag = document.createElement("style");
    styleTag.textContent = `
      .att-sheet table th, .att-sheet table td { border:1px solid #000; padding:0 1px; font-size:10px; line-height:1.2; text-align:center; vertical-align:middle; }
      .att-sheet table th { background:#fafafa; font-weight:600; }
      .att-sheet .name-col { text-align:left; padding-left:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .att-sheet .mark-cell { height:18px; }
      .att-sheet tbody tr { height:18px; }
    `;
    container.appendChild(styleTag);
    document.body.appendChild(container);
    try {
      const totalRowPages = Math.max(1, Math.ceil((students.length || 1) / ROWS_PER_PRINT_PAGE));
      const allColPages = Math.max(1, Math.ceil(state.headers.length / COLS_PER_PRINT_PAGE));

      // เลือกเฉพาะ "หน้าคอลัมน์" ที่มีการแก้ไข (มี header วัน/เดือน หรือมีเครื่องหมายของนักเรียน)
      const activeColPages: number[] = [];
      for (let cp = 0; cp < allColPages; cp++) {
        const cs = cp * COLS_PER_PRINT_PAGE;
        const ce = Math.min(cs + COLS_PER_PRINT_PAGE, state.headers.length);
        const headerHasData = state.headers.slice(cs, ce).some((h) => (h.day || "").trim() || (h.month || "").trim());
        const marksHasData = (students as any[]).some((st) => {
          const arr = state.marks[st.id] || [];
          for (let k = cs; k < ce; k++) if ((arr[k] || "").trim()) return true;
          return false;
        });
        if (headerHasData || marksHasData) activeColPages.push(cp);
      }
      if (activeColPages.length === 0) {
        toast.error("ยังไม่มีหน้าที่กรอกข้อมูล — โปรดกรอกเวลาเรียนก่อนพิมพ์");
        return;
      }

      const totalPages = totalRowPages * activeColPages.length;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      let pageNo = 0;
      for (let rp = 0; rp < totalRowPages; rp++) {
        for (const cp of activeColPages) {
          pageNo++;
          const rowStart = rp * ROWS_PER_PRINT_PAGE;
          const rowEnd = Math.min(rowStart + ROWS_PER_PRINT_PAGE, students.length);
          const colStart = cp * COLS_PER_PRINT_PAGE;
          const colEnd = Math.min(colStart + COLS_PER_PRINT_PAGE, state.headers.length);
          const html = buildPageHtml(rowStart, rowEnd, colStart, colEnd, pageNo, totalPages);
          const pageDiv = document.createElement("div");
          pageDiv.innerHTML = html;
          container.appendChild(pageDiv);
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          const target = pageDiv.firstElementChild as HTMLElement;
          const canvas = await html2canvas(target, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            windowWidth: target.scrollWidth,
            windowHeight: target.scrollHeight,
          });
          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const ratio = Math.min(pageW / (canvas.width / 2 / 3.78), pageH / (canvas.height / 2 / 3.78));
          const imgW = (canvas.width / 2 / 3.78) * ratio;
          const imgH = (canvas.height / 2 / 3.78) * ratio;
          if (pageNo > 1) pdf.addPage();
          pdf.addImage(imgData, "JPEG", (pageW - imgW) / 2, (pageH - imgH) / 2, imgW, imgH);
          container.removeChild(pageDiv);
        }
      }
      const subjCode = (assignment as any)?.subjects?.code || "subject";
      const clsName = `${(assignment as any)?.classrooms?.grade_level || ""}${(assignment as any)?.classrooms?.section ? "-" + (assignment as any)?.classrooms?.section : ""}`;
      pdf.save(`เวลาเรียน_${subjCode}_${clsName}.pdf`);
      toast.success(`ดาวน์โหลด PDF สำเร็จ (${pageNo} หน้า)`);
    } catch (e: any) {
      console.error(e);
      toast.error("สร้าง PDF ไม่สำเร็จ: " + (e?.message || ""));
    } finally {
      document.body.removeChild(container);
      setExporting(false);
    }
  };


  const countPresent = (sid: string) => {
    const arr = state.marks[sid] || [];
    return arr.filter((m) => m === "✓" || m === "ป").length;
  };

  // Group headers by month for the top row spans
  const monthSpans = useMemo(() => {
    const out: { month: string; span: number }[] = [];
    let cur = "";
    for (const h of state.headers) {
      const m = h.month || "";
      if (out.length === 0 || out[out.length - 1].month !== m) {
        out.push({ month: m, span: 1 });
      } else {
        out[out.length - 1].span += 1;
      }
      cur = m;
    }
    return out;
  }, [state.headers]);

  return (
    <div className="min-h-screen bg-muted/30 p-4 print:p-0 print:bg-white">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          .no-print { display: none !important; }
          html, body { background: white; margin: 0; padding: 0; }
          .att-sheet { width: 285mm !important; padding: 0 !important; box-shadow: none !important; }
          .att-sheet thead { display: table-header-group; }
          .att-sheet tr { page-break-inside: avoid; }
          .att-input { border: none !important; background: transparent !important; }
        }
        .att-sheet { font-family: 'TH Sarabun New', 'Sarabun', serif; color: #000; }
        .att-sheet table { border-collapse: collapse; width: 100%; table-layout: fixed; }
        .att-sheet th, .att-sheet td { border: 1px solid #000; padding: 0 1px; font-size: 10px; line-height: 1.15; text-align: center; vertical-align: middle; }
        .att-sheet th { font-weight: 600; background: #fafafa; }
        .att-sheet .name-col { text-align: left; padding-left: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 10px; }
        .att-sheet input, .att-sheet select { width: 100%; border: none; background: transparent; text-align: center; font-size: 9px; font-family: inherit; padding: 0; outline: none; -webkit-appearance: none; appearance: none; }
        .att-sheet input:focus, .att-sheet select:focus { background: #fff7cc; }
        .att-sheet .mark-cell { cursor: pointer; user-select: none; height: 16px; padding: 0; }
        .att-sheet .header-line { font-size: 13px; margin: 1px 0; line-height: 1.35; }
        .att-sheet .header-line .blank { display: inline-block; min-width: 50px; border-bottom: 1px dotted #555; padding: 0 3px; }
        .att-sheet tbody tr { height: 17px; }
      `}</style>

      <div className="no-print mb-3 flex flex-wrap items-center gap-3 max-w-[297mm] mx-auto">
        <Button onClick={() => exportPdf()} size="sm" disabled={exporting}>
          <FileDown className="w-4 h-4 mr-1" /> {exporting ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}
        </Button>
        <Button
          onClick={() => { if (confirm("ดึงข้อมูลจากการเช็คชื่อรายคาบของวิชานี้? (จะแทนที่ข้อมูลในตาราง)")) importFromAttendance(); }}
          size="sm"
          variant="secondary"
          disabled={importing}
        >
          {importing ? "กำลังดึง..." : "ดึงจากเช็คชื่อรายคาบ"}
        </Button>
        <label className="flex items-center gap-1 text-xs">
          จำนวนคาบ:
          <input
            type="number"
            min={MIN_COLS}
            max={MAX_COLS}
            value={state.headers.length}
            onChange={(e) => setNumCols(Number(e.target.value) || DEFAULT_NUM_COLS)}
            className="w-16 h-7 border rounded text-center text-xs"
          />
        </label>
        <span className="text-xs text-muted-foreground">คลิกช่องเพื่อสลับ: ว่าง → ✓ → ล → ป → ส</span>
      </div>

      <div className="no-print mb-3 flex flex-wrap items-center gap-2 max-w-[297mm] mx-auto p-2 rounded-md border bg-muted/40">
        <span className="text-xs font-medium mr-1">กรอกเร็ว (เฉพาะช่องว่าง):</span>
        {[
          { v: "✓", label: "มา ✓", cls: "bg-emerald-500 hover:bg-emerald-600 text-white" },
          { v: "ล", label: "ลา ล", cls: "bg-amber-500 hover:bg-amber-600 text-white" },
          { v: "ป", label: "ป่วย ป", cls: "bg-sky-500 hover:bg-sky-600 text-white" },
          { v: "ส", label: "ขาด ส", cls: "bg-rose-500 hover:bg-rose-600 text-white" },
        ].map((b) => (
          <button
            key={b.v}
            type="button"
            onClick={() => { fillAll(b.v, true); toast.success(`เติม "${b.v}" ในช่องว่างทั้งหมดแล้ว`); }}
            className={`px-2.5 py-1 rounded text-xs ${b.cls}`}
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto px-2.5 py-1 rounded text-xs border text-destructive hover:bg-destructive/10"
        >
          ล้างทั้งหมด
        </button>
      </div>


      <div ref={sheetRef} className="att-sheet bg-white mx-auto p-3" style={{ width: "297mm", minHeight: "210mm" }}>
        {/* Header lines */}
        <div className="header-line text-center font-semibold">
          เวลาเรียน&nbsp;&nbsp;ชื่อรายวิชา <span className="blank">{subj.name_th || ""}</span>
          &nbsp;รหัสวิชา <span className="blank">{subj.code || ""}</span>
          &nbsp;ชั้น/ห้อง <span className="blank">{cls.grade_level || ""}{cls.section ? "/" + cls.section : ""}</span>
        </div>
        <div className="header-line">
          จำนวน
          <input
            className="att-input"
            style={{ width: 40, borderBottom: "1px dotted #555", textAlign: "center" }}
            value={state.credits}
            onChange={(e) => setState((s) => ({ ...s, credits: e.target.value }))}
          />
          หน่วยกิต&nbsp;&nbsp;จำนวนชั่วโมงที่เรียนเต็ม
          <input
            className="att-input"
            style={{ width: 50, borderBottom: "1px dotted #555", textAlign: "center" }}
            value={state.totalHours}
            onChange={(e) => setState((s) => ({ ...s, totalHours: e.target.value }))}
          />
          ชั่วโมง&nbsp;&nbsp;เวลาเรียนร้อยละ 80 คิดเป็น
          <input
            className="att-input"
            style={{ width: 50, borderBottom: "1px dotted #555", textAlign: "center" }}
            value={state.eightyHours}
            onChange={(e) => setState((s) => ({ ...s, eightyHours: e.target.value }))}
          />
          ชั่วโมง&nbsp;&nbsp;&nbsp;&nbsp;ภาคเรียนที่ {assignment?.semester || ""} ปีการศึกษา
          <input
            className="att-input"
            style={{ width: 60, borderBottom: "1px dotted #555", textAlign: "center" }}
            value={state.academicYear}
            onChange={(e) => setState((s) => ({ ...s, academicYear: e.target.value }))}
          />
          &nbsp;&nbsp;ครูผู้สอน: {per.prefix || ""}{per.first_name || ""} {per.last_name || ""}
        </div>

        {/* Table */}
        <table style={{ marginTop: 4 }}>
          <colgroup>
            <col style={{ width: "22px" }} />
            <col style={{ width: "52px" }} />
            <col style={{ width: "115px" }} />
            {state.headers.map((_, i) => (
              <col key={i} style={{ width: `calc((100% - 189px - 64px) / ${state.headers.length})` }} />
            ))}
            <col style={{ width: "32px" }} />
            <col style={{ width: "32px" }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>เลข<br/>ที่</th>
              <th rowSpan={2}>เลข<br/>ประจำตัว<br/>นักเรียน</th>
              <th rowSpan={2}>ชื่อ - สกุล</th>
              {state.headers.map((h, i) => (
                <th key={i} style={{ padding: 0 }}>
                  <select
                    className="att-input"
                    value={h.month}
                    onChange={(e) => updateHeader(i, "month", e.target.value)}
                    title="คลิกขวาเพื่อเติมเดือนทั้งแถว"
                    onContextMenu={(ev) => {
                      ev.preventDefault();
                      const v = prompt(`เติมเดือนทุกคอลัมน์ด้วย (เว้นว่าง=ล้าง)`, h.month || "");
                      if (v === null) return;
                      setState((s) => ({ ...s, headers: s.headers.map((x) => ({ ...x, month: v })) }));
                    }}
                  >
                    <option value=""></option>
                    {MONTHS.map((mn) => <option key={mn} value={mn}>{mn}</option>)}
                  </select>
                </th>
              ))}
              <th rowSpan={2}>รวม</th>
              <th rowSpan={2}>ร้อยละ</th>
            </tr>
            <tr>
              {state.headers.map((h, i) => (
                <th
                  key={i}
                  style={{ padding: 0 }}
                  title="คลิกขวาเพื่อเติมทั้งคอลัมน์"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const v = prompt(`เติมคาบที่ ${i + 1} ให้นักเรียนทุกคนด้วย (✓/ล/ป/ส) — เว้นว่าง=ล้างคอลัมน์`, "✓");
                    if (v === null) return;
                    fillCol(i, v, false);
                  }}
                >
                  <input
                    className="att-input"
                    value={h.day}
                    onChange={(e) => updateHeader(i, "day", e.target.value)}
                    placeholder="วัน"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((st: any, idx: number) => {
              const present = countPresent(st.id);
              const pct = state.hoursTaught ? Math.round((present / Number(state.hoursTaught)) * 100) : 0;
              return (
                <tr key={st.id} data-student-row>
                  <td>{idx + 1}</td>
                  <td>{st.student_code}</td>
                  <td
                    className="name-col"
                    title="คลิกขวาเพื่อเติมทั้งแถว"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const v = prompt(`เติมทั้งแถวของ ${st.first_name} ${st.last_name} ด้วย (✓/ล/ป/ส) — เว้นว่าง=ล้างทั้งแถว`, "✓");
                      if (v === null) return;
                      if (v === "") { setState((s) => { const m = { ...s.marks }; delete m[st.id]; return { ...s, marks: m }; }); }
                      else fillRow(st.id, v, false);
                    }}
                  >{st.prefix || ""}{st.first_name} {st.last_name}</td>
                  {state.headers.map((_, c) => {
                    const m = state.marks[st.id]?.[c] || "";
                    return (
                      <td
                        key={c}
                        className="mark-cell"
                        onClick={() => cycleMark(st.id, c)}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          const v = prompt("กรอกเครื่องหมาย (เช่น ✓, ล, ป, ส)", m) ?? m;
                          setMark(st.id, c, v);
                        }}
                      >
                        {m}
                      </td>
                    );
                  })}
                  <td>{present}</td>
                  <td>{pct}</td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr><td colSpan={state.headers.length + 5} style={{ padding: 12 }}>ไม่มีข้อมูลนักเรียน</td></tr>
            )}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10, fontSize: 12 }}>
          <div>หมายเหตุ: ✓ = มาเรียน, ล = ลา, ป = ป่วย, ส = ขาด</div>
          {schoolInfo?.school_name && (
            <div style={{ fontSize: 11 }}>โรงเรียน{schoolInfo.school_name}</div>
          )}
          <div style={{ textAlign: "center" }}>
            ลงชื่อ ............................................. ครูผู้สอน<br/>
            ({per.prefix || ""}{per.first_name || ""} {per.last_name || ""})
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pp5AttendancePrintPage;
