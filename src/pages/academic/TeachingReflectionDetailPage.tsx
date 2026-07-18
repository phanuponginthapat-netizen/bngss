import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Printer, Check, Undo2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useReflectionDetail, useReflectionMutations,
  STATUS_LABEL, STATUS_COLOR, type SignerRole, type ReflectionStatus,
} from "@/hooks/useTeachingReflections";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserDepartments } from "@/hooks/useUserDepartments";
import { useSubjectGroupHeads } from "@/hooks/useSubjectGroupHeads";
import { SignaturePad } from "@/components/academic/SignaturePad";
import { useSchoolReport } from "@/hooks/useSchoolReport";
import { openPrintWindow } from "@/lib/exporters/common";
import { supabase } from "@/integrations/supabase/client";
import { getSigners, type SignerRole as MapSignerRole } from "@/lib/signerMap";
import { useReflectionSigSettings, resolveSizePx, type ReflectionSigSetting } from "@/hooks/useReflectionSigSettings";
import { useAllSignatures } from "@/hooks/useSignatures";
import { Settings2 } from "lucide-react";

const ROLE_TO_SIGNER_MAP: Partial<Record<SignerRole, MapSignerRole>> = {
  head_subject: "subject_group_head",
  academic_head: "academic_head",
  deputy: "deputy_academic",
  director: "director",
};
import { formatDateLongBE } from "@/lib/dateBE";

const SUBJECT_GROUP_LABEL: Record<string, string> = {
  thai: "ภาษาไทย", math: "คณิตศาสตร์", science: "วิทยาศาสตร์และเทคโนโลยี",
  social: "สังคมศึกษา ศาสนา และวัฒนธรรม", health_pe: "สุขศึกษาและพลศึกษา",
  arts: "ศิลปะ", occupation: "การงานอาชีพ", foreign_lang: "ภาษาต่างประเทศ",
  special_ed: "การศึกษาพิเศษ",
};

const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const formatFullThaiDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return formatDateLongBE(iso);
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${formatDateLongBE(iso)}`;
};

const formatClassroom = (name?: string) => {
  if (!name) return "";
  const m = name.match(/^(ม|ป)\.?\s*(\d+)(?:\/(\d+))?$/);
  if (!m) return name;
  const level = m[1] === "ม" ? "ชั้นมัธยมศึกษาปีที่" : "ชั้นประถมศึกษาปีที่";
  return `${level} ${m[2]}${m[3] ? `/${m[3]}` : ""}`;
};

const SIGN_STEPS: { role: SignerRole; label: string; nextStatus: ReflectionStatus }[] = [
  { role: "teacher", label: "ครูผู้สอน", nextStatus: "submitted" },
  { role: "head_subject", label: "หัวหน้ากลุ่มสาระ", nextStatus: "head_signed" },
  { role: "academic_head", label: "หัวหน้าฝ่ายวิชาการ", nextStatus: "academic_signed" },
  { role: "deputy", label: "รองผู้อำนวยการ", nextStatus: "deputy_signed" },
  { role: "director", label: "ผู้อำนวยการ", nextStatus: "director_signed" },
];

export default function TeachingReflectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useReflectionDetail(id);
  const { userId, isAdmin, isDirector } = useUserRole();
  const { canManageDept } = useUserDepartments();
  const { isHeadOf } = useSubjectGroupHeads();
  const { sign, returnForFix } = useReflectionMutations();
  const { info } = useSchoolReport();
  const { data: sigSettingsMap } = useReflectionSigSettings();
  const { data: allSigs = [] } = useAllSignatures();
  const [contextMeta, setContextMeta] = useState<{ subject?: string; classroom?: string; teacher?: string; period?: string }>({});

  useEffect(() => {
    if (!data?.reflection) return;
    const r = data.reflection;
    (async () => {
      const [sj, cl, tp, ap] = await Promise.all([
        r.subject_id ? (supabase.from("subjects").select("name_th,code").eq("id", r.subject_id).maybeSingle() as any) : Promise.resolve({ data: null }),
        r.classroom_id ? (supabase.from("classrooms").select("name").eq("id", r.classroom_id).maybeSingle() as any) : Promise.resolve({ data: null }),
        (supabase.from("profiles").select("first_name,last_name,prefix").eq("id", r.teacher_id).maybeSingle() as any),
        r.academic_period_id ? (supabase.from("academic_periods").select("academic_year_be,semester").eq("id", r.academic_period_id).maybeSingle() as any) : Promise.resolve({ data: null }),
      ]);
      setContextMeta({
        subject: sj?.data ? `${sj.data.name_th}${sj.data.code ? ` (${sj.data.code})` : ""}` : undefined,
        classroom: cl?.data?.name,
        teacher: tp?.data ? `${tp.data.prefix || ""}${tp.data.first_name || ""} ${tp.data.last_name || ""}`.trim() : undefined,
        period: ap?.data ? `${ap.data.academic_year_be}/${ap.data.semester}` : undefined,
      });
    })();
  }, [data?.reflection?.id]);

  const [sigDrafts, setSigDrafts] = useState<Record<SignerRole, string | null>>({} as any);
  const [commentDrafts, setCommentDrafts] = useState<Record<SignerRole, string>>({} as any);
  const [returnComment, setReturnComment] = useState("");
  const [teacherOverride, setTeacherOverride] = useState<string>("");
  const [headOverride, setHeadOverride] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewTitle, setPreviewTitle] = useState<string>("");

  // รายชื่อบุคลากร/ครูทั้งหมดจากตาราง personnel — ใช้เลือกช่อง "ครูผู้สอน"
  const { data: personnelList = [] } = useQuery({
    queryKey: ["reflection-personnel-picker"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name, position, subject_group")
        .order("first_name");
      return (data || [])
        .map((p: any) => ({
          id: p.id,
          name: `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim(),
          position: p.position || "",
          subject_group: p.subject_group || "",
        }))
        .filter((p) => p.name);
    },
  });

  // รายชื่อ "หัวหน้ากลุ่มสาระ" จากผังจริง (subject_group_heads) — เท่านั้น
  const { data: headList = [] } = useQuery({
    queryKey: ["reflection-subject-group-heads-picker"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: heads } = await (supabase as any)
        .from("subject_group_heads")
        .select("user_id, subject_group, position")
        .eq("position", "head");
      const ids = Array.from(new Set((heads || []).map((h: any) => h.user_id).filter(Boolean)));
      if (!ids.length) return [] as { id: string; name: string; subject_group: string }[];
      const [{ data: profs }, { data: pers }] = await Promise.all([
        (supabase as any).from("profiles").select("id,prefix,first_name,last_name").in("id", ids),
        (supabase as any).from("personnel").select("user_id,prefix,first_name,last_name").in("user_id", ids),
      ]);
      const nameMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => {
        nameMap[p.id] = `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim();
      });
      (pers || []).forEach((p: any) => {
        if (p.user_id && !nameMap[p.user_id])
          nameMap[p.user_id] = `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim();
      });
      return (heads || [])
        .map((h: any) => ({ id: h.user_id, name: nameMap[h.user_id] || "", subject_group: h.subject_group }))
        .filter((h: any) => h.name);
    },
  });

  const r = data?.reflection;
  const signMap = useMemo(() => {
    const m: Partial<Record<SignerRole, any>> = {};
    (data?.signatures || []).forEach((s) => { if (!m[s.signer_role] || s.signed_at > m[s.signer_role].signed_at) m[s.signer_role] = s; });
    return m;
  }, [data]);

  if (isLoading || !r) return <div className="p-6">กำลังโหลด...</div>;

  const canSign = (role: SignerRole): boolean => {
    if (isAdmin) return true;
    if (role === "teacher") return r.teacher_id === userId;
    if (role === "head_subject") return !!r.subject_group && isHeadOf(r.subject_group as any);
    if (role === "academic_head") return canManageDept("academic");
    if (role === "deputy") return isDirector || canManageDept("director_office");
    if (role === "director") return isDirector;
    return false;
  };

  const stepIndex = (status: ReflectionStatus) => {
    const map: Record<ReflectionStatus, number> = {
      draft: 0, submitted: 1, head_signed: 2, academic_signed: 3, deputy_signed: 4, director_signed: 5, returned: 0,
    };
    return map[status];
  };

  const handleSign = async (role: SignerRole, nextStatus: ReflectionStatus) => {
    let signatureUrl: string | undefined = sigDrafts[role] || undefined;
    let signerName: string | undefined;
    // Admin per-slot setting → prefer explicit signature/name over auto keyword mapping
    const slotSetting = (sigSettingsMap || {})[role];
    if (role !== "teacher") {
      if (slotSetting?.signature_id) {
        const s = allSigs.find((x) => x.id === slotSetting.signature_id);
        if (s?.signature_url) signatureUrl = s.signature_url;
        if (s?.name) signerName = slotSetting.override_name || s.name;
      } else {
        const mapRole = ROLE_TO_SIGNER_MAP[role];
        if (mapRole) {
          const signers = await getSigners([mapRole]);
          const s = signers[mapRole];
          if (s?.signature_url) signatureUrl = s.signature_url;
          if (s?.name) signerName = slotSetting?.override_name || s.name;
        }
      }
      // Respect render mode "blank" / "name_only" → don't store an image
      if (slotSetting?.render_mode && slotSetting.render_mode !== "image") {
        signatureUrl = undefined;
      }
    }
    await sign.mutateAsync({
      reflectionId: r.id, role,
      signatureUrl,
      signerName,
      comment: commentDrafts[role]?.trim() || undefined,
      nextStatus,
    });
  };

  const buildPrintBody = async () => {
    const [signers, headRow] = await Promise.all([
      getSigners(["academic_head", "deputy_academic", "director"]),
      r.subject_group
        ? (supabase
            .from("subject_group_heads")
            .select("user_id, profiles:user_id(prefix,first_name,last_name)")
            .eq("subject_group", r.subject_group)
            .maybeSingle() as any)
        : Promise.resolve({ data: null }),
    ]);
    const teacherName = teacherOverride || signMap.teacher?.signer_name || contextMeta.teacher || "";
    const teacherSig = signMap.teacher?.signature_url || "";
    const p = headRow?.data?.profiles;
    const subjectHeadName =
      headOverride ||
      signMap.head_subject?.signer_name ||
      (p ? `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim() : "");
    const subjectHeadSig = signMap.head_subject?.signature_url || "";
    const headName = signers.academic_head?.name || signMap.academic_head?.signer_name || "นางสาวรุ่งทิพย์ ผ่านพินิจ";
    const headTitle = signers.academic_head?.position || "หัวหน้าฝ่ายวิชาการ";
    const headSig = signMap.academic_head?.signature_url || signers.academic_head?.signature_url || "";
    const depName = signers.deputy_academic?.name || signMap.deputy?.signer_name || "นางสาวอนงลักษณ์ ขุนอินทร์";
    const depTitle = signers.deputy_academic?.position || `รองผู้อำนวยการโรงเรียนเจียรวนนท์อุทิศ 2`;
    const depSig = signMap.deputy?.signature_url || signers.deputy_academic?.signature_url || "";
    const dirName = signers.director?.name || info.director_name || signMap.director?.signer_name || "";
    const dirTitle = signers.director?.position || `ผู้อำนวยการ${info.school_name || "โรงเรียนเจียรวนนท์อุทิศ 2"}`;
    const dirSig = signMap.director?.signature_url || signers.director?.signature_url || "";

    const ck = (on: boolean) => on ? "☒" : "☐";
    const outcomes = (r.learning_outcomes || "").replace(/\n/g, "<br/>");
    const problems = (r.problems || "").replace(/\n/g, "<br/>") || "&nbsp;";
    const suggestions = (r.suggestions || "").replace(/\n/g, "<br/>") || "&nbsp;";
    const total = Number(r.students_total) || 0;
    const pass = Number(r.students_pass) || 0;
    const fail = Number(r.students_fail) || 0;
    const passPct = Number(r.pass_percent || 0).toFixed(1);
    const failPct = total ? ((fail / total) * 100).toFixed(1) : "0.0";
    const dateFull = formatFullThaiDate(r.lesson_date);
    const classroomFull = formatClassroom(contextMeta.classroom);
    const groupLabel = r.subject_group ? (SUBJECT_GROUP_LABEL[r.subject_group] || r.subject_group) : "";
    const periodRange = r.period_no
      ? `${r.period_no}${r.hours_taught > 1 ? `-${r.period_no + Number(r.hours_taught) - 1}` : ""}`
      : "-";

    // Resolve per-slot admin settings — controls signer source, render mode, size, alignment, offset.
    const settingsMap = (sigSettingsMap || {}) as Record<SignerRole, ReflectionSigSetting>;
    const resolveSlot = (
      role: SignerRole,
      defaultName: string,
      defaultTitle: string,
      defaultSigUrl: string,
    ) => {
      const st = settingsMap[role];
      let name = defaultName;
      let title = defaultTitle;
      let sigUrl = defaultSigUrl;
      if (st) {
        if (st.signature_id) {
          const explicit = allSigs.find((s) => s.id === st.signature_id);
          if (explicit) {
            name = st.override_name || explicit.name || name;
            title = st.override_position || explicit.position || title;
            sigUrl = explicit.signature_url || sigUrl;
          }
        } else {
          if (st.override_name) name = st.override_name;
          if (st.override_position) title = st.override_position;
        }
      }
      return { name, title, sigUrl, st };
    };

    const sigBlock = (
      role: SignerRole,
      name: string,
      title: string,
      sigUrl: string,
      comment?: string,
    ) => {
      const st = settingsMap[role];
      const mode = st?.render_mode || (role === "teacher" ? "image" : "image");
      const align = st?.align || "center";
      const offX = Number(st?.offset_x_mm) || 0;
      const offY = Number(st?.offset_y_mm) || 0;
      const sizePx = st ? resolveSizePx(st) : 40;
      const showComment = st ? st.show_comment_line : role !== "teacher";
      const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
      const imgHtml =
        mode === "image"
          ? (sigUrl ? `<img src="${sigUrl}" crossorigin="anonymous" style="max-height:${sizePx}px;max-width:200px;object-fit:contain"/>` : "")
          : mode === "name_only"
            ? `<span style="font-weight:600">${name || ""}</span>`
            : ""; /* blank */
      return `
      <div class="sig-item" style="text-align:${align}; transform: translate(${offX}mm, ${offY}mm);">
        ${showComment ? `<div class="sig-comment">${comment && comment.trim()
          ? `ความคิดเห็น: ${comment.replace(/</g,"&lt;")}`
          : `ความคิดเห็น ................................................................`}</div>` : ""}
        <div class="sig-img" style="height:${sizePx}px;justify-content:${justify}">${imgHtml}</div>
        <div class="sig-line">ลงชื่อ ................................................</div>
        <div class="sig-name">(${name || "&nbsp;.....................................................&nbsp;"})</div>
        <div class="sig-title">${title}</div>
      </div>`;
    };

    const attachments = (data?.attachments || []).filter(a => a.file_url);
    const attachmentBlock = attachments.length ? `
      <div class="section attach-section">
        <b>๕. ชิ้นงาน / หลักฐาน</b>
        <div class="attach-grid">
          ${attachments.map(a => `
            <div class="attach-item">
              <img src="${a.file_url}" crossorigin="anonymous"/>
              ${a.caption ? `<div class="attach-caption">${a.caption}</div>` : ""}
            </div>`).join("")}
        </div>
      </div>` : "";

    const body = `
      <style>
        @page { size: A4; margin: 20mm 22mm; }
        html, body { margin:0; padding:0; }
        .print-doc, .print-doc * { font-size: 10pt !important; line-height: 1.5; font-family: "TH Sarabun New","Sarabun",sans-serif; color:#111; }
        .print-doc { font-size: 10pt; }
        .print-doc .header-wrap { text-align:center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
        .print-doc .school { font-weight: bold; }
        .print-doc .addr { color:#333; }
        .print-doc .title { font-weight: bold; margin-top: 8px; }
        .print-doc .meta { margin: 10px 0; padding: 8px 12px; background:#f6f7fb; border-left: 4px solid #2563eb; border-radius: 4px; }
        .print-doc .meta div { margin: 3px 0; }
        .print-doc .section { margin-top: 10px; text-align: left; }
        .print-doc .section b { color:#1e3a8a; }
        .print-doc .box { padding: 6px 12px; border: 1px dashed #999; border-radius: 4px; margin-top: 4px; min-height: 22px; }
        .print-doc .kpa { display:grid; grid-template-columns: repeat(4,1fr); gap:6px; margin-top:6px; }
        .print-doc .kpa .card { border:1px solid #ddd; border-radius:6px; padding:6px 8px; text-align:center; background:#fafbff; }
        .print-doc .kpa .k { color:#666; }
        .print-doc .kpa .v { font-weight: bold; color:#1d4ed8; }
        .print-doc .attach-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; margin-top:5px; }
        .print-doc .attach-item { border:1px solid #ddd; border-radius:5px; overflow:hidden; page-break-inside:avoid; }
        .print-doc .attach-item img { width:100%; height:120px; object-fit:cover; display:block; }
        .print-doc .attach-caption { padding:3px 5px; text-align:center; background:#f6f7fb; font-size: 8pt !important; }
        .print-doc .attach-section, .print-doc .attach-section * { font-size: 8pt !important; }
        .print-doc .sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px 20px; margin-top: 18px; }
        .print-doc .sig-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 20px; margin-top: 24px; max-width: 66%; margin-left: auto; margin-right: auto; }
        .print-doc .sig-item { text-align:center; page-break-inside:avoid; }
        .print-doc .sig-img { height: 40px; display:flex; align-items:flex-end; justify-content:center; margin-bottom:2px; }
        .print-doc .sig-img img { max-height: 40px; max-width: 160px; object-fit: contain; }
        .print-doc .sig-line { margin-top: 2px; }
        .print-doc .sig-name { font-weight: 600; margin-top: 2px; }
        .print-doc .sig-title { color:#333; }
        .print-doc .sig-comment { text-align:left; margin-bottom: 6px; color:#111; }
      </style>
      <div class="print-doc">
        <div class="header-wrap">
          <div class="school">โรงเรียนเจียรวนนท์อุทิศ 2</div>
          <div class="addr">สำนักงานเขตพื้นที่การศึกษาประถมศึกษานครราชสีมา เขต 3</div>
          <div class="title">บันทึกหลังการสอน</div>
        </div>

        <div class="meta">
          <div><b>รายวิชา:</b> ${contextMeta.subject || "................................"} &nbsp;&nbsp;&nbsp; <b>ชั้น:</b> ${classroomFull || "................................"} &nbsp;&nbsp;&nbsp; <b>ครูผู้สอน:</b> ${teacherName || "................................"}</div>
          <div><b>กลุ่มสาระ:</b> ${groupLabel || "................................"} &nbsp;&nbsp;&nbsp; <b>ปีการศึกษา/ภาคเรียน:</b> ${contextMeta.period || "......../......"} &nbsp;&nbsp;&nbsp; <b>คาบที่:</b> ${periodRange} &nbsp;&nbsp;&nbsp; <b>จำนวน:</b> ${r.hours_taught} คาบ</div>
          <div><b>หน่วยการเรียนรู้ / หัวข้อ:</b> ${r.lesson_topic} &nbsp;&nbsp;&nbsp; <b>วันที่สอน:</b> ${dateFull}</div>
        </div>

        <div class="section">
          <b>๑. ผลการจัดการเรียนรู้</b> &nbsp; ${ck(true)} สอนได้ตามแผนการจัดการเรียนรู้
          <div class="box">${outcomes || "&nbsp;"}</div>
        </div>

        <div class="section">
          <b>๒. ผลการเรียนของนักเรียน</b>
          <div class="box">
            จำนวนนักเรียนทั้งหมด <b>${total}</b> คน &nbsp; <span style="color:#16a34a;font-weight:bold;">✓</span> ผ่าน <b>${pass}</b> คน คิดเป็นร้อยละ <b>${passPct}</b> &nbsp; <span style="color:#dc2626;font-weight:bold;">✗</span> ไม่ผ่าน <b>${fail}</b> คน คิดเป็นร้อยละ <b>${failPct}</b>
          </div>
          <div class="box" style="margin-top:4px;">
            <b>ผลการประเมิน</b> — <span style="color:#16a34a;font-weight:bold;">✓</span> ความรู้ (K) ร้อยละ <b>${Number(r.score_knowledge || 0).toFixed(1)}</b> &nbsp; <span style="color:#16a34a;font-weight:bold;">✓</span> ทักษะกระบวนการ (P) ร้อยละ <b>${Number(r.score_process || 0).toFixed(1)}</b> &nbsp; <span style="color:#16a34a;font-weight:bold;">✓</span> เจตคติ (A) ร้อยละ <b>${Number(r.score_attitude || 0).toFixed(1)}</b>
          </div>
        </div>

        <div class="section"><b>๓. ปัญหาและอุปสรรค</b><div class="box">${problems}</div></div>
        <div class="section"><b>๔. ข้อเสนอแนะ / แนวทางแก้ไข</b><div class="box">${suggestions}</div></div>

        ${attachmentBlock}

        <div class="sig-grid">
          ${(() => { const r0 = resolveSlot("teacher", teacherName, "ครูผู้สอน", teacherSig); return sigBlock("teacher", r0.name, r0.title, r0.sigUrl); })()}
          ${(() => { const r0 = resolveSlot("head_subject", subjectHeadName, `หัวหน้ากลุ่มสาระฯ${groupLabel ? " " + groupLabel : ""}`, subjectHeadSig); return sigBlock("head_subject", r0.name, r0.title, r0.sigUrl, signMap.head_subject?.comment); })()}
          ${(() => { const r0 = resolveSlot("academic_head", headName, headTitle, headSig); return sigBlock("academic_head", r0.name, r0.title, r0.sigUrl, signMap.academic_head?.comment); })()}
        </div>
        <div class="sig-grid-2">
          ${(() => { const r0 = resolveSlot("deputy", depName, depTitle, depSig); return sigBlock("deputy", r0.name, r0.title, r0.sigUrl, signMap.deputy?.comment); })()}
          ${(() => { const r0 = resolveSlot("director", dirName, dirTitle, dirSig); return sigBlock("director", r0.name, r0.title, r0.sigUrl, signMap.director?.comment); })()}
        </div>
      </div>
    `;
    return { body, title: `บันทึกหลังสอน - ${r.lesson_topic}` };
  };

  const handlePrint = async () => {
    const { body, title } = await buildPrintBody();
    openPrintWindow(body, title);
  };

  const handlePreview = async () => {
    const { body, title } = await buildPrintBody();
    // Mirror exactly the wrapper used by openPrintWindow so preview = print output
    const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>${title}</title>
<style>
@font-face { font-family: 'TH Sarabun New'; src: url('/fonts/thsarabunnew-webfont.woff') format('woff'); font-weight: 400; }
@font-face { font-family: 'TH Sarabun New'; src: url('/fonts/thsarabunnew_bold-webfont.woff') format('woff'); font-weight: 700; }
* { box-sizing: border-box; }
body { font-family: 'TH Sarabun New','Sarabun',serif; font-size: 16pt; color:#000; margin:0; padding:18mm; background:#fff; }
h1,h2,h3 { margin: 0 0 6px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #333; padding: 4px 6px; vertical-align: middle; }
thead th { background: #f0f0f0; text-align: center; }
@page { size: A4; margin: 12mm; }
</style></head><body>${body}</body></html>`;
    setPreviewTitle(title);
    setPreviewHtml(html);
    setPreviewOpen(true);
  };




  const currentStep = stepIndex(r.status);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link to="/dashboard/academic/teaching-reflections">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> กลับ</Button>
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Badge className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
          {(isAdmin || isDirector) && (
            <Link to="/dashboard/admin/teaching-reflection-signatures">
              <Button variant="outline" size="sm"><Settings2 className="w-4 h-4 mr-1" /> ตั้งค่าจุดลายเซ็น</Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={handlePreview}><Eye className="w-4 h-4 mr-1" /> ตัวอย่างก่อนพิมพ์</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" /> พิมพ์ PDF</Button>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>ตัวอย่างก่อนพิมพ์ · {previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-muted/40">
            <iframe title="print-preview" srcDoc={previewHtml} className="w-full h-full bg-white" />
          </div>
          <DialogFooter className="p-3 border-t bg-background">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>ปิด</Button>
            <Button onClick={() => { setPreviewOpen(false); handlePrint(); }}>
              <Printer className="w-4 h-4 mr-1" /> พิมพ์เอกสารนี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="text-sm font-semibold mb-2">🖨️ ตั้งชื่อผู้ลงนามในเอกสารพิมพ์</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">ครูผู้สอน (แสดงในช่อง ................ และในวงเล็บ)</Label>
            <Select value={teacherOverride || "__default__"} onValueChange={(v) => setTeacherOverride(v === "__default__" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__default__">— ใช้ค่าเริ่มต้น (ครูเจ้าของเอกสาร) —</SelectItem>
                {personnelList.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}{p.position ? ` · ${p.position}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">หัวหน้ากลุ่มสาระ (แสดงในวงเล็บ) — เฉพาะรายชื่อตามผังตำแหน่งหัวหน้ากลุ่มสาระ</Label>
            <Select value={headOverride || "__default__"} onValueChange={(v) => setHeadOverride(v === "__default__" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__default__">— ใช้ค่าเริ่มต้นตามกลุ่มสาระ —</SelectItem>
                {headList.length === 0 && (
                  <SelectItem value="__none__" disabled>ยังไม่มีการกำหนดหัวหน้ากลุ่มสาระในผัง</SelectItem>
                )}
                {headList.map((p) => (
                  <SelectItem key={`${p.id}-${p.subject_group}`} value={p.name}>
                    {p.name} · หัวหน้ากลุ่มสาระ{SUBJECT_GROUP_LABEL[p.subject_group] || p.subject_group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h1 className="text-xl font-bold">{r.lesson_topic}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><div className="text-muted-foreground">วันที่สอน</div><div className="font-medium">{r.lesson_date}</div></div>
          <div><div className="text-muted-foreground">คาบที่</div><div className="font-medium">{r.period_no ?? "-"}</div></div>
          <div><div className="text-muted-foreground">จำนวนคาบ</div><div className="font-medium">{r.hours_taught}</div></div>
          <div><div className="text-muted-foreground">% ผ่าน</div><div className="font-bold text-primary text-lg">{Number(r.pass_percent).toFixed(1)}%</div></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["knowledge", "process", "attitude"] as const).map((k) => {
            const labels = { knowledge: "K", process: "P", attitude: "A" };
            const val = (r as any)[`score_${k}`];
            return (
              <Card key={k} className="p-3 text-center">
                <div className="text-xs text-muted-foreground">{labels[k]}</div>
                <div className="text-2xl font-bold text-primary">{val}%</div>
              </Card>
            );
          })}
        </div>
        <div>
          <h3 className="font-semibold mt-2">ผลการจัดการเรียนรู้</h3>
          <p className="whitespace-pre-wrap text-sm">{r.learning_outcomes || "—"}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><h3 className="font-semibold">ปัญหา / อุปสรรค</h3><p className="whitespace-pre-wrap text-sm">{r.problems || "—"}</p></div>
          <div><h3 className="font-semibold">ข้อเสนอแนะ</h3><p className="whitespace-pre-wrap text-sm">{r.suggestions || "—"}</p></div>
        </div>
        {!!data?.attachments?.length && (
          <div>
            <h3 className="font-semibold">ชิ้นงาน / หลักฐาน</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              {data.attachments.map((a) => (
                <div key={a.id} className="border rounded-md overflow-hidden">
                  <img src={a.file_url} alt="" className="aspect-square object-cover w-full" />
                  {a.caption && <div className="p-1 text-xs text-center">{a.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-bold text-lg">ลำดับการลงนามอนุมัติ</h2>
        <div className="space-y-3">
          {SIGN_STEPS.map((step, idx) => {
            const existing = signMap[step.role];
            const isCurrent = idx + 1 === currentStep + 1 || (step.role === "teacher" && !existing);
            const activate = !existing && canSign(step.role) && (idx === 0 || currentStep >= idx);
            return (
              <Card key={step.role} className={`p-4 ${existing ? "bg-emerald-50 dark:bg-emerald-950/20" : isCurrent ? "border-primary" : "opacity-80"}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-sm text-muted-foreground">ขั้นที่ {idx + 1}</div>
                    <div className="font-semibold">{step.label}</div>
                    {existing && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ลงนาม: {new Date(existing.signed_at).toLocaleString("th-TH")}
                        {existing.comment && <div className="text-xs italic">💬 {existing.comment}</div>}
                      </div>
                    )}
                  </div>
                  {existing?.signature_url && (
                    <img src={existing.signature_url} alt="signature" className="h-14 object-contain bg-white rounded border" />
                  )}
                  {activate && (
                    <div className="w-full md:w-80 space-y-2">
                      {step.role === "teacher" ? (
                        <>
                          <SignaturePad
                            value={sigDrafts[step.role]}
                            onChange={(v) => setSigDrafts((prev) => ({ ...prev, [step.role]: v }))}
                          />
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`sig-file-${step.role}`} className="text-xs text-muted-foreground">
                              หรือแนบไฟล์ลายเซ็น:
                            </Label>
                            <input
                              id={`sig-file-${step.role}`}
                              type="file"
                              accept="image/*"
                              className="text-xs"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const reader = new FileReader();
                                reader.onload = () => setSigDrafts((prev) => ({ ...prev, [step.role]: reader.result as string }));
                                reader.readAsDataURL(f);
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded border border-dashed">
                          ระบบจะดึงลายเซ็นที่ผู้ดูแลตั้งค่าไว้มาใช้อัตโนมัติเมื่อกดอนุมัติ
                        </div>
                      )}
                      {step.role !== "teacher" && (
                        <Textarea
                          rows={2}
                          placeholder="ความคิดเห็น (จะแสดงบนเอกสารพิมพ์)"
                          value={commentDrafts[step.role] ?? ""}
                          onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [step.role]: e.target.value }))}
                        />
                      )}
                      <Button size="sm" className="w-full" onClick={() => handleSign(step.role, step.nextStatus)}>
                        <Check className="w-4 h-4 mr-1" /> {step.role === "teacher" ? "ลงนามส่ง" : "อนุมัติ"}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {(canManageDept("academic") || isAdmin || isDirector) && r.status !== "director_signed" && r.status !== "returned" && (
          <Card className="p-4 bg-red-50/50 dark:bg-red-950/10 border-red-200">
            <h3 className="font-semibold text-red-700 flex items-center gap-2"><Undo2 className="w-4 h-4" /> ส่งกลับให้แก้ไข</h3>
            <Textarea rows={2} placeholder="ระบุเหตุผล..." value={returnComment} onChange={(e) => setReturnComment(e.target.value)} className="mt-2" />
            <Button variant="destructive" size="sm" className="mt-2"
              onClick={() => { if (returnComment.trim()) returnForFix.mutate({ id: r.id, comment: returnComment }); }}>
              ส่งกลับ
            </Button>
          </Card>
        )}
      </Card>
    </div>
  );
}
