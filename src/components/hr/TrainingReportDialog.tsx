import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, FileDown, Send, Save, Loader2, ImageIcon, X } from "lucide-react";
import { SendEFormDialog } from "@/components/eform/SendEFormDialog";
import { generateTrainingReportPdf, type TrainingReportData } from "@/lib/trainingReportPdf";
import { DateInput } from "@/components/ui/date-input";
import { DateTimeInput } from "@/components/ui/datetime-input";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  personnelId: string | null;          // selected personnel (for admin/director use)
  myPersonnelId?: string | null;       // current user's own personnel
  canManageAll: boolean;
  onSaved?: () => void;
  recordId?: string | null;            // if set → edit mode
  initialAction?: "edit" | "pdf" | "send" | null;
}

const ORDER_TYPES = [
  { value: "district", label: "คำสั่งจากเขตพื้นที่การศึกษา" },
  { value: "school", label: "คำสั่งจากโรงเรียน" },
  { value: "other", label: "อื่น ๆ" },
];

const blankList = (n: number) => Array.from({ length: n }, () => "");

export const TrainingReportDialog = ({ open, onOpenChange, personnelId, myPersonnelId, canManageAll, onSaved, recordId, initialAction }: Props) => {
  const propTargetId = canManageAll ? personnelId : myPersonnelId;
  // In edit mode the record's personnel_id wins; otherwise use prop
  const [loadedRecordPersonnelId, setLoadedRecordPersonnelId] = useState<string | null>(null);
  const targetPersonnelId = recordId ? loadedRecordPersonnelId : propTargetId;
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fields
  const [orderType, setOrderType] = useState("district");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [startDt, setStartDt] = useState("");
  const [endDt, setEndDt] = useState("");
  const [location, setLocation] = useState("");
  const [days, setDays] = useState("");
  const [hours, setHours] = useState("");
  const [title, setTitle] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [objectives, setObjectives] = useState<string[]>(blankList(3));
  const [knowledge, setKnowledge] = useState<string[]>(blankList(3));
  const [applications, setApplications] = useState<string[]>(blankList(3));
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [assignedTeachers, setAssignedTeachers] = useState<string[]>([""]);
  const [orderTypeOther, setOrderTypeOther] = useState("");
  const [orderDocPath, setOrderDocPath] = useState("");

  // E-form launcher state
  const [sendOpen, setSendOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [eformTitle, setEformTitle] = useState("");

  // Personnel info — try (1) targetPersonnelId, then fallback (2) personnel.user_id = auth user, then (3) profiles
  const { data: personnelInfo } = useQuery({
    queryKey: ["personnel-for-training", targetPersonnelId, open],
    enabled: open,
    queryFn: async () => {
      // 1) explicit personnel id (admin selected or own)
      if (targetPersonnelId) {
        const { data } = await supabase.from("personnel")
          .select("prefix, first_name, last_name, position, academic_standing")
          .eq("id", targetPersonnelId).maybeSingle();
        if (data) return data;
      }
      // 2) lookup by auth user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: byUser } = await supabase.from("personnel")
        .select("prefix, first_name, last_name, position, academic_standing")
        .eq("user_id", user.id).maybeSingle();
      if (byUser) return byUser;
      // 3) fallback to profile (only basic name available)
      const { data: prof } = await supabase.from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id).maybeSingle();
      if (prof) return { prefix: "", first_name: (prof as any).first_name || "", last_name: (prof as any).last_name || "", position: "", academic_standing: "" };
      return null;
    },
  });



  // School info
  const { data: school } = useQuery({
    queryKey: ["primary-school"],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("school_name, director_name").limit(1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!open) {
      // reset
      setOrderType("district"); setOrderNumber(""); setOrderDate(""); setOrderTypeOther("");
      setStartDt(""); setEndDt(""); setLocation(""); setDays(""); setHours("");
      setTitle(""); setOrganizer("");
      setObjectives(blankList(3)); setKnowledge(blankList(3)); setApplications(blankList(3));
      setImagePaths([]); setAttachmentPaths([]); setAssignedTeachers([""]);
      setOrderDocPath(""); setPdfFile(null);
      setLoadedRecordPersonnelId(null);
    }
  }, [open]);

  // Load existing record (edit mode)
  useEffect(() => {
    if (!open || !recordId) return;
    (async () => {
      const { data, error } = await supabase.from("id_plan_records").select("*").eq("id", recordId).maybeSingle();
      if (error || !data) { toast.error("โหลดข้อมูลไม่สำเร็จ"); return; }
      const r: any = data;
      setOrderType(r.order_ref_type || "district");
      setOrderTypeOther(r.order_ref_type_other || "");
      setOrderNumber(r.order_ref_number || "");
      setOrderDate(r.order_ref_date || "");
      setStartDt(r.start_datetime ? String(r.start_datetime).slice(0, 16) : "");
      setEndDt(r.end_datetime ? String(r.end_datetime).slice(0, 16) : "");
      setLocation(r.location || "");
      setDays(r.duration_days ? String(r.duration_days) : "");
      setHours(r.training_hours ? String(r.training_hours) : "");
      setTitle(r.title || "");
      setOrganizer(r.organizer || "");
      const padTo3 = (arr: any) => {
        const a = Array.isArray(arr) ? arr.filter(Boolean) : [];
        while (a.length < 3) a.push("");
        return a;
      };
      setObjectives(padTo3(r.objectives));
      setKnowledge(padTo3(r.knowledge_summary));
      setApplications(padTo3(r.applications));
      setImagePaths(Array.isArray(r.image_paths) ? r.image_paths : []);
      setAttachmentPaths(Array.isArray(r.attachment_paths) ? r.attachment_paths : []);
      const at = Array.isArray(r.assigned_teachers) ? r.assigned_teachers : [];
      setAssignedTeachers(at.length ? at.map((x: any) => String(x)) : [""]);
      setOrderDocPath(r.order_doc_path || "");
      setLoadedRecordPersonnelId(r.personnel_id || null);
    })();
  }, [open, recordId]);

  // Auto-run initial action after data loads in edit mode
  const ranActionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) { ranActionRef.current = null; return; }
    if (!recordId || !initialAction || !title) return;
    const key = `${recordId}:${initialAction}`;
    if (ranActionRef.current === key) return;
    ranActionRef.current = key;
    if (initialAction === "pdf") { handleExportPdf(); }
    if (initialAction === "send") { handleSendEform(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordId, initialAction, title]);



  const uploadFile = async (file: File, kind: "order" | "image") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("กรุณาเข้าสู่ระบบ"); return null; }
    const safeName = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${user.id}/id-plan/${Date.now()}-${kind}-${safeName}`;
    const { error } = await supabase.storage.from("pa-files").upload(path, file, { contentType: file.type });
    if (error) { toast.error("อัปโหลดล้มเหลว: " + error.message); return null; }
    return path;
  };

  const personName = personnelInfo
    ? `${personnelInfo.prefix || ""}${personnelInfo.first_name} ${personnelInfo.last_name}`.trim()
    : "";
  const positionLabel = personnelInfo?.position || personnelInfo?.academic_standing || "";

  const buildReportData = (): TrainingReportData => ({
    schoolName: school?.school_name || "โรงเรียน",
    directorName: school?.director_name || "",
    orderType,
    orderTypeLabel: orderType === "other" && orderTypeOther.trim()
      ? orderTypeOther.trim()
      : (ORDER_TYPES.find(o => o.value === orderType)?.label || ""),
    orderNumber,
    orderDate,
    personName,
    position: positionLabel,
    assignedTeachers: assignedTeachers.map(s => s.trim()).filter(Boolean),
    title,
    organizer,
    startDt,
    endDt,
    location,
    days,
    hours,
    objectives: objectives.filter(Boolean),
    knowledge: knowledge.filter(Boolean),
    applications: applications.filter(Boolean),
    imagePaths,
    attachmentPaths,
  });

  const validate = () => {
    if (!targetPersonnelId) { toast.error("ยังไม่พบบุคลากร"); return false; }
    if (!title.trim()) { toast.error("กรุณากรอกชื่อหลักสูตร"); return false; }
    if (!startDt) { toast.error("กรุณาระบุวันและเวลา"); return false; }
    if (!location.trim()) { toast.error("กรุณาระบุสถานที่"); return false; }
    if (orderType === "other" && !orderTypeOther.trim()) { toast.error("กรุณาระบุประเภทคำสั่ง"); return false; }
    if (objectives.filter(Boolean).length < 3) { toast.error("วัตถุประสงค์อย่างน้อย 3 ข้อ"); return false; }
    if (knowledge.filter(Boolean).length < 3) { toast.error("สรุปองค์ความรู้อย่างน้อย 3 ข้อ"); return false; }
    if (applications.filter(Boolean).length < 3) { toast.error("การนำไปประยุกต์ใช้อย่างน้อย 3 ข้อ"); return false; }
    if (imagePaths.length < 3) { toast.error("แนบรูปภาพอย่างน้อย 3 รูป"); return false; }
    return true;
  };

  const saveRecord = async (): Promise<string | null> => {
    if (!validate()) return null;
    setBusy(true);
    try {
      const payload: any = {
        personnel_id: targetPersonnelId, plan_type: "training",
        title, organizer,
        training_hours: hours ? parseInt(hours) : 0,
        training_date: startDt ? startDt.slice(0, 10) : null,
        status: "completed",
        order_doc_path: orderDocPath || null,
        image_paths: imagePaths,
        attachment_paths: attachmentPaths,
        assigned_teachers: assignedTeachers.map(s => s.trim()).filter(Boolean),
        order_ref_type: orderType,
        order_ref_type_other: orderType === "other" ? orderTypeOther.trim() || null : null,
        order_ref_number: orderNumber || null,
        order_ref_date: orderDate || null,
        start_datetime: startDt || null,
        end_datetime: endDt || null,
        location, duration_days: days ? parseInt(days) : null,
        objectives: objectives.filter(Boolean),
        knowledge_summary: knowledge.filter(Boolean),
        applications: applications.filter(Boolean),
      };
      if (recordId) {
        const { error } = await supabase.from("id_plan_records").update(payload).eq("id", recordId);
        if (error) { toast.error(error.message); return null; }
        toast.success("อัปเดตรายงานสำเร็จ");
        onSaved?.();
        return recordId;
      } else {
        const { data, error } = await supabase.from("id_plan_records").insert(payload).select("id").single();
        if (error) { toast.error(error.message); return null; }
        toast.success("บันทึกรายงานสำเร็จ");
        onSaved?.();
        return data.id;
      }
    } finally {
      setBusy(false);
    }
  };


  const handleSaveOnly = async () => {
    const id = await saveRecord();
    if (id) onOpenChange(false);
  };

  const handleExportPdf = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const blob = await generateTrainingReportPdf(buildReportData());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `รายงานการอบรม-${title || "training"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error("สร้าง PDF ล้มเหลว: " + (e?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  const handleSendEform = async () => {
    const id = await saveRecord();
    if (!id) return;
    setBusy(true);
    try {
      const blob = await generateTrainingReportPdf(buildReportData());
      const file = new File([blob], `รายงานการอบรม-${title || "training"}.pdf`, { type: "application/pdf" });
      setPdfFile(file);
      setEformTitle(`รายงานผลการอบรม: ${title}`);
      setSendOpen(true);
    } catch (e: any) {
      toast.error("สร้าง PDF ล้มเหลว: " + (e?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  const updateListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    list: string[], idx: number, value: string
  ) => {
    const next = [...list]; next[idx] = value; setter(next);
  };

  const renderList = (
    label: string, list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-sm">{label} <span className="text-xs text-muted-foreground">(อย่างน้อย 3 ข้อ)</span></Label>
        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setter([...list, ""])}>
          <Plus className="w-3.5 h-3.5 mr-1" />เพิ่ม
        </Button>
      </div>
      <div className="space-y-2">
        {list.map((v, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-sm text-muted-foreground mt-2 w-6 shrink-0">{i + 1}.</span>
            <Textarea value={v} onChange={(e) => updateListItem(setter, list, i, e.target.value)} rows={1} className="flex-1 min-h-[40px]" />
            {list.length > 3 && (
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                onClick={() => setter(list.filter((_, j) => j !== i))}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>บันทึกรายงานการไปอบรม</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Identity (auto-filled) */}
            <Card className="p-3 bg-muted/40">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">ผู้รายงาน:</span> <span className="font-medium">{personName || "—"}</span></div>
                <div><span className="text-muted-foreground">ตำแหน่ง:</span> <span className="font-medium">{positionLabel || "—"}</span></div>
              </div>
            </Card>

            {/* ครูที่ได้รับมอบหมายไปอบรม */}
            <Card className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium">
                  ครูที่ได้รับมอบหมายให้ไปอบรม
                  <span className="text-xs text-muted-foreground ml-2">จำนวน {assignedTeachers.filter(s => s.trim()).length} คน</span>
                </Label>
                <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setAssignedTeachers([...assignedTeachers, ""])}>
                  <Plus className="w-3.5 h-3.5 mr-1" />เพิ่มชื่อครู
                </Button>
              </div>
              <div className="space-y-2">
                {assignedTeachers.map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-sm text-muted-foreground mt-2 w-6 shrink-0">{i + 1}.</span>
                    <Input
                      value={v}
                      onChange={(e) => {
                        const next = [...assignedTeachers]; next[i] = e.target.value; setAssignedTeachers(next);
                      }}
                      placeholder="ชื่อ-นามสกุล ครู"
                      className="flex-1"
                    />
                    {assignedTeachers.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0"
                        onClick={() => setAssignedTeachers(assignedTeachers.filter((_, j) => j !== i))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>


            {/* 1. อ้างอิงคำสั่ง */}
            <Card className="p-3 space-y-3">
              <Label className="font-medium">1. อ้างอิงหนังสือคำสั่ง</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">ประเภท</Label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORDER_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">เลขที่หนังสือ</Label>
                  <Input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="เช่น ศธ 04xxx/xxxx" />
                </div>
                <div>
                  <Label className="text-xs">ลงวันที่</Label>
                  <DateInput value={orderDate} onChange={e => setOrderDate(e.target.value)} />
                </div>
              </div>
              {orderType === "other" && (
                <div>
                  <Label className="text-xs">ระบุประเภทคำสั่ง *</Label>
                  <Input value={orderTypeOther} onChange={e => setOrderTypeOther(e.target.value)} placeholder="เช่น คำสั่งจากสำนักงานเขตพื้นที่การศึกษา" />
                </div>
              )}
            </Card>

            {/* 2,3,4 */}
            <Card className="p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">2. วันและเวลา (เริ่ม) *</Label>
                  <DateTimeInput value={startDt} onChange={e => setStartDt(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">วันและเวลา (สิ้นสุด)</Label>
                  <DateTimeInput value={endDt} onChange={e => setEndDt(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">3. สถานที่ *</Label>
                <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="เช่น ห้องประชุม สพป.นครราชสีมา เขต 3" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">4. จำนวนวัน</Label>
                  <Input type="number" min="0" value={days} onChange={e => setDays(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">จำนวนชั่วโมง</Label>
                  <Input type="number" min="0" value={hours} onChange={e => setHours(e.target.value)} />
                </div>
              </div>
            </Card>

            {/* 5. ชื่อหลักสูตร */}
            <Card className="p-3 space-y-3">
              <div>
                <Label className="text-xs">5. ชื่อหลักสูตร/เรื่องที่อบรม *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">หน่วยงานผู้จัด</Label>
                <Input value={organizer} onChange={e => setOrganizer(e.target.value)} placeholder="เช่น สพฐ., สพป., คุรุสภา" />
              </div>
            </Card>

            {/* 6,7,8 lists */}
            <Card className="p-3">{renderList("6. วัตถุประสงค์ของการเข้ารับอบรม", objectives, setObjectives)}</Card>
            <Card className="p-3">{renderList("7. สรุปองค์ความรู้ในการเข้ารับการอบรม", knowledge, setKnowledge)}</Card>
            <Card className="p-3">{renderList("8. การนำไปประยุกต์ใช้ในการปฏิบัติงาน", applications, setApplications)}</Card>

            {/* 9. รูปภาพ */}
            <Card className="p-3 space-y-2">
              <Label className="font-medium">9. รูปภาพประกอบ <span className="text-xs text-muted-foreground">(อย่างน้อย 3 รูป) — มีแล้ว {imagePaths.length}</span></Label>
              {imagePaths.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {imagePaths.map((p, i) => (
                    <div key={p} className="relative border rounded p-2 text-xs flex items-center gap-1 bg-muted/30">
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1">{p.split("/").pop()}</span>
                      <button type="button" onClick={() => setImagePaths(imagePaths.filter((_, j) => j !== i))}>
                        <X className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Input
                type="file" accept="image/*" multiple disabled={uploading}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []); if (!files.length) return;
                  setUploading(true);
                  const uploaded: string[] = [];
                  for (const f of files) {
                    const p = await uploadFile(f, "image");
                    if (p) uploaded.push(p);
                  }
                  setUploading(false);
                  setImagePaths(prev => [...prev, ...uploaded]);
                  e.target.value = "";
                }}
              />
              {uploading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> กำลังอัปโหลด...</p>}
            </Card>

            {/* 10. ไฟล์เอกสารแนบ (PDF/รูปภาพ) */}
            <Card className="p-3 space-y-2">
              <Label className="font-medium">
                10. ไฟล์เอกสารการอบรม
                <span className="text-xs text-muted-foreground ml-2">(แนบไฟล์ PDF/Word/รูปภาพ — มีแล้ว {attachmentPaths.length})</span>
              </Label>
              {attachmentPaths.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {attachmentPaths.map((p, i) => (
                    <div key={p} className="relative border rounded p-2 text-xs flex items-center gap-1 bg-muted/30">
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1">{p.split("/").pop()}</span>
                      <button type="button" onClick={() => setAttachmentPaths(attachmentPaths.filter((_, j) => j !== i))}>
                        <X className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Input
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                multiple disabled={uploading}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []); if (!files.length) return;
                  setUploading(true);
                  const uploaded: string[] = [];
                  for (const f of files) {
                    const p = await uploadFile(f, "image");
                    if (p) uploaded.push(p);
                  }
                  setUploading(false);
                  setAttachmentPaths(prev => [...prev, ...uploaded]);
                  e.target.value = "";
                }}
              />
            </Card>
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
            <Button variant="secondary" onClick={handleExportPdf} disabled={busy}>
              <FileDown className="w-4 h-4 mr-1" />Export PDF
            </Button>
            <Button variant="secondary" onClick={handleSaveOnly} disabled={busy}>
              <Save className="w-4 h-4 mr-1" />บันทึก
            </Button>
            <Button onClick={handleSendEform} disabled={busy}>
              <Send className="w-4 h-4 mr-1" />บันทึก + ส่ง E-Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pdfFile && (
        <SendEFormDialog
          open={sendOpen}
          onOpenChange={(v) => { setSendOpen(v); if (!v) { setPdfFile(null); onOpenChange(false); } }}
          title={eformTitle}
          contentHtml={`<p>รายงานผลการอบรม <b>${title}</b> โดย ${personName} (${positionLabel})</p><p>โปรดดูรายละเอียดจากเอกสาร PDF ที่แนบมา</p>`}
          category="training-report"
          urgency="normal"
          initialFiles={[pdfFile]}
        />
      )}
    </>
  );
};
