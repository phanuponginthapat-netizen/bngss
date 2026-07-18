import { useState, useRef, useMemo, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Send, Eye, CheckCircle2, FileText, Paperclip, Download, File, Search, Reply } from "lucide-react";
import { useAcademicYearFilter } from "@/hooks/useAcademicYearFilter";
import { isDataUrl, openDataUrl, uploadPrivateFileWithFallback } from "@/lib/uploadFallback";
import { notify } from "@/lib/notify";

const DocumentPage = () => {
  const { lang } = useLanguage();
  const { isAdmin, isDirector } = useUserRole();
  const qc = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { selectedYear, setSelectedYear, availableYears, toBE } = useAcademicYearFilter();
  const [searchTerm, setSearchTerm] = useState("");
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);
  const [open, setOpen] = useState(false);
  const [docNumber, setDocNumber] = useState("");
  const [title, setTitle] = useState("");
  const [fromDept, setFromDept] = useState("");
  const [docType, setDocType] = useState("outgoing");
  const [notes, setNotes] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reply dialog state
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyRecipient, setReplyRecipient] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyUploading, setReplyUploading] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const [recipientMode, setRecipientMode] = useState<"department" | "personnel" | "all">("department");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const departments = ["วิชาการ", "กิจการนักเรียน", "บริหารทั่วไป", "งบประมาณและบุคคล", "ผู้อำนวยการ", "ConnextED"];

  const { data: records = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: recipients = [] } = useQuery({
    queryKey: ["document_recipients_all"],
    queryFn: async () => {
      const { data } = await supabase.from("document_recipients" as any).select("*");
      return (data || []) as any[];
    },
  });

  const { data: personnelList = [] } = useQuery({
    queryKey: ["personnel_list_for_docs"],
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("id, prefix, first_name, last_name, position, department, employee_code").eq("status", "active").order("first_name");
      return data || [];
    },
  });

  const filteredPersonnel = useMemo(() => {
    let list = personnelList as any[];
    if (deptFilter) list = list.filter((p: any) => p.department === deptFilter);
    if (personnelSearch) {
      const term = personnelSearch.toLowerCase();
      list = list.filter((p: any) =>
        `${p.prefix || ""}${p.first_name} ${p.last_name}`.toLowerCase().includes(term) ||
        p.employee_code?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [personnelList, deptFilter, personnelSearch]);

  // Fetch profiles to map personnel to user_ids for notifications (via SECURITY DEFINER RPC for non-admin roles)
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles_for_notifications"],
    queryFn: async () => {
      const { data: dir } = await (supabase.rpc as any)("get_personnel_directory");
      if (dir && (dir as any[]).length) return dir as any[];
      const { data } = await supabase.from("profiles").select("id, employee_code, first_name, last_name");
      return (data || []) as any[];
    },
  });

  const toggleDept = (dept: string) => setSelectedDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
  const togglePersonnel = (id: string) => setSelectedPersonnel(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const handleAdd = async () => {
    if (!docNumber || !title) { toast.error("กรุณากรอกเลขที่และเรื่อง"); return; }

    const allRecipients: { type: string; name: string; personnelId?: string }[] = [];
    let effectivePersonnelIds: string[] = [];
    if (recipientMode === "department") {
      if (selectedDepts.length === 0) { toast.error("กรุณาเลือกผู้รับอย่างน้อย 1 ฝ่าย"); return; }
      // Expand departments → individual personnel so they receive both the recipient row and the push/LINE notification
      const deptMembers = (personnelList as any[]).filter(p => selectedDepts.includes(p.department));
      if (deptMembers.length === 0) { toast.error("ไม่พบบุคลากรในฝ่ายที่เลือก"); return; }
      effectivePersonnelIds = deptMembers.map(p => p.id);
      selectedDepts.forEach(d => allRecipients.push({ type: "department", name: d }));
      deptMembers.forEach(p => allRecipients.push({
        type: "personnel",
        name: `${p.prefix || ""}${p.first_name} ${p.last_name}`,
        personnelId: p.id,
      }));
    } else if (recipientMode === "all") {
      if (personnelList.length === 0) { toast.error("ไม่พบรายชื่อบุคลากร"); return; }
      effectivePersonnelIds = (personnelList as any[]).map(p => p.id);
      (personnelList as any[]).forEach(p => allRecipients.push({
        type: "personnel",
        name: `${p.prefix || ""}${p.first_name} ${p.last_name}`,
        personnelId: p.id,
      }));
    } else {
      if (selectedPersonnel.length === 0) { toast.error("กรุณาเลือกผู้รับอย่างน้อย 1 คน"); return; }
      effectivePersonnelIds = selectedPersonnel;
      selectedPersonnel.forEach(pid => {
        const p = personnelList.find((x: any) => x.id === pid);
        if (p) allRecipients.push({ type: "personnel", name: `${p.prefix || ""}${p.first_name} ${p.last_name}`, personnelId: pid });
      });
    }

    setUploading(true);

    // Upload file if attached
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    if (attachedFile) {
      const safe = attachedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `outgoing/${Date.now()}_${safe}`;
      const upload = await uploadPrivateFileWithFallback("document-files", path, attachedFile, { upsert: true });
      fileUrl = upload.path; // store path; we'll create signed URL on download, or data URL while storage is unavailable
      fileName = attachedFile.name;
    }

    const toDeptStr = allRecipients.map(r => r.name).join(", ");

    const insertData: any = { doc_number: docNumber, title, from_department: fromDept, to_department: toDeptStr, doc_type: docType, notes, created_by: currentUserId };
    if (fileUrl) {
      insertData.file_url = fileUrl;
      insertData.file_name = fileName;
    }

    const { data: doc, error } = await supabase.from("documents").insert(insertData).select("id").single();
    if (error || !doc) { toast.error(error?.message || "เกิดข้อผิดพลาด"); setUploading(false); return; }

    // Save recipient_user_id for personnel recipients
    const recipientRows = allRecipients.map((r) => {
      const row: any = {
        document_id: doc.id,
        recipient_type: r.type,
        recipient_name: r.name,
      };
      if (r.type === "personnel" && r.personnelId) {
        const person = personnelList.find((x: any) => x.id === r.personnelId);
        if (person) {
          const profile = allProfiles.find((pr: any) => pr.employee_code === (person as any).employee_code);
          if (profile) row.recipient_user_id = profile.id;
        }
      }
      return row;
    });
    await supabase.from("document_recipients" as any).insert(recipientRows as any);

    // Fan-out notification to recipients (in-app + push + LINE) via unified notify()
    // Works for personnel / all / department modes — department mode now resolves to member personnel above
    if (effectivePersonnelIds.length > 0) {
      const recipientUserIds: string[] = [];
      effectivePersonnelIds.forEach(pid => {
        const person = personnelList.find((x: any) => x.id === pid);
        if (!person) return;
        const profile = allProfiles.find((pr: any) => pr.employee_code === (person as any).employee_code);
        if (profile) recipientUserIds.push(profile.id);
      });
      if (recipientUserIds.length > 0) {
        await notify({
          user_ids: recipientUserIds,
          title: `📄 เอกสารใหม่: ${title}`,
          body: `เลขที่ ${docNumber} จาก ${fromDept || "ไม่ระบุ"}`,
          type: "document",
          severity: "info",
          reference_id: doc.id,
          reference_type: "documents",
          url: `/dashboard/inbox?tab=documents&doc=${doc.id}`,
        });
      }
    }

    toast.success("บันทึกและส่งเอกสารสำเร็จ");
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["document_recipients_all"] });
    setOpen(false);
    resetForm();
    setUploading(false);
  };

  const resetForm = () => {
    setDocNumber(""); setTitle(""); setFromDept(""); setNotes("");
    setDocType("outgoing"); setRecipientMode("department");
    setSelectedDepts([]); setSelectedPersonnel([]);
    setAttachedFile(null); setPersonnelSearch(""); setDeptFilter("");
  };

  const downloadFile = async (pathOrUrl: string, name?: string) => {
    if (isDataUrl(pathOrUrl)) {
      openDataUrl(pathOrUrl, name);
      return;
    }
    // Backward compat: if it looks like a public URL, just open it
    if (/^https?:\/\//i.test(pathOrUrl)) {
      window.open(pathOrUrl, "_blank");
      return;
    }
    const { data, error } = await supabase.storage.from("document-files").createSignedUrl(pathOrUrl, 60 * 5);
    if (error || !data?.signedUrl) {
      toast.error("ไม่สามารถเปิดไฟล์ได้");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const openReply = (rec: any) => {
    setReplyRecipient(rec);
    setReplyMessage(rec.reply_message || "");
    setReplyFile(null);
    setReplyOpen(true);
  };

  const handleSendReply = async () => {
    if (!replyRecipient) return;
    if (!replyMessage.trim() && !replyFile) {
      toast.error("กรุณาระบุข้อความหรือแนบไฟล์อย่างน้อย 1 อย่าง");
      return;
    }
    setReplyUploading(true);
    let filePath: string | null = replyRecipient.reply_file_url || null;
    let fileName: string | null = replyRecipient.reply_file_name || null;
    if (replyFile) {
      const safe = replyFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `replies/${replyRecipient.document_id}/${Date.now()}_${safe}`;
      const upload = await uploadPrivateFileWithFallback("document-files", path, replyFile, { upsert: true });
      filePath = upload.path;
      fileName = replyFile.name;
    }
    const { error } = await supabase.from("document_recipients" as any).update({
      reply_message: replyMessage,
      reply_file_url: filePath,
      reply_file_name: fileName,
      replied_at: new Date().toISOString(),
      is_read: true,
      read_at: replyRecipient.read_at || new Date().toISOString(),
    } as any).eq("id", replyRecipient.id);
    if (error) {
      toast.error("ส่งคำตอบล้มเหลว: " + error.message);
      setReplyUploading(false);
      return;
    }
    toast.success("ส่งคำตอบกลับเรียบร้อย");
    qc.invalidateQueries({ queryKey: ["document_recipients_all"] });
    setReplyOpen(false);
    setReplyRecipient(null);
    setReplyMessage("");
    setReplyFile(null);
    setReplyUploading(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("documents").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["documents"] });
    qc.invalidateQueries({ queryKey: ["document_recipients_all"] });
  };

  const handleStatusChange = async (id: string, status: string) => {
    await supabase.from("documents").update({ status } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const getRecipientsForDoc = (docId: string) => recipients.filter((r: any) => r.document_id === docId);

  const docTypeLabels: Record<string, string> = {
    incoming: lang === "th" ? "หนังสือรับ" : "Incoming",
    outgoing: lang === "th" ? "หนังสือส่ง" : "Outgoing",
    internal: lang === "th" ? "ภายใน" : "Internal",
  };

  const statusLabels: Record<string, string> = {
    pending: lang === "th" ? "รอดำเนินการ" : "Pending",
    in_progress: lang === "th" ? "กำลังดำเนินการ" : "In Progress",
    completed: lang === "th" ? "เสร็จสิ้น" : "Completed",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{lang === "th" ? "สารบรรณอิเล็กทรอนิกส์" : "E-Saraban"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th" ? "ระบบจัดการและส่งเอกสารราชการ • เก็บข้อมูลย้อนหลัง 3 ปี" : "Document management — 3 years retention"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "สร้างเอกสาร" : "New Document"}</Button>
          </DialogTrigger>
            <DialogContent className="sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary" />
                  {lang === "th" ? "สร้างและส่งเอกสาร" : "Create & Send Document"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>เลขที่เอกสาร</Label>
                    <Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="เช่น ศธ 04001/001" />
                  </div>
                  <div>
                    <Label>ประเภท</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incoming">หนังสือรับ</SelectItem>
                        <SelectItem value="outgoing">หนังสือส่ง</SelectItem>
                        <SelectItem value="internal">ภายใน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>เรื่อง</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="ระบุชื่อเรื่องของเอกสาร" />
                </div>

                <div>
                  <Label>จาก (หน่วยงาน/ผู้ส่ง)</Label>
                  <Input value={fromDept} onChange={e => setFromDept(e.target.value)} placeholder="เช่น ฝ่ายวิชาการ" />
                </div>

                {/* File attachment */}
                <div className="space-y-2 border border-border rounded-lg p-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-primary" /> แนบไฟล์เอกสาร
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="w-3 h-3 mr-1" /> เลือกไฟล์
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      className="hidden"
                      onChange={e => setAttachedFile(e.target.files?.[0] || null)}
                    />
                    {attachedFile && (
                      <div className="flex items-center gap-2 text-sm">
                        <File className="w-3 h-3 text-primary" />
                        <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setAttachedFile(null)}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">รองรับ PDF, รูปภาพ (JPG, PNG), Word (.doc, .docx)</p>
                </div>

                {/* Recipient selection */}
                <div className="space-y-3 border border-border rounded-lg p-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Send className="w-4 h-4 text-primary" /> ส่งถึง
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={recipientMode === "department" ? "default" : "outline"} onClick={() => setRecipientMode("department")}>ฝ่ายงาน</Button>
                    <Button type="button" size="sm" variant={recipientMode === "personnel" ? "default" : "outline"} onClick={() => setRecipientMode("personnel")}>บุคคล (ครู/ผอ.)</Button>
                    <Button type="button" size="sm" variant={recipientMode === "all" ? "default" : "outline"} onClick={() => setRecipientMode("all")}>
                      ทุกคน ({personnelList.length})
                    </Button>
                  </div>

                  {recipientMode === "all" && (
                    <div className="text-xs bg-primary/10 text-primary rounded-lg p-3 flex items-start gap-2">
                      <Send className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        จะส่งเอกสารและแจ้งเตือนถึงบุคลากรทุกคน ({personnelList.length} คน) ในระบบ
                      </span>
                    </div>
                  )}

                  {recipientMode === "department" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {departments.map(dept => (
                        <label key={dept} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                          <Checkbox checked={selectedDepts.includes(dept)} onCheckedChange={() => toggleDept(dept)} />
                          {dept}
                        </label>
                      ))}
                    </div>
                  )}

                  {recipientMode === "personnel" && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Search className="absolute left-2 top-2.5 w-3 h-3 text-muted-foreground" />
                          <Input
                            placeholder="ค้นหาชื่อหรือรหัส..."
                            value={personnelSearch}
                            onChange={e => setPersonnelSearch(e.target.value)}
                            className="h-8 text-xs pl-7"
                          />
                        </div>
                        <Select value={deptFilter} onValueChange={v => setDeptFilter(v === "all" ? "" : v)}>
                          <SelectTrigger className="h-8 text-xs w-[140px]">
                            <SelectValue placeholder="ทุกฝ่าย" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">ทุกฝ่าย</SelectItem>
                            {departments.map(d => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedPersonnel.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {selectedPersonnel.map(pid => {
                            const p = personnelList.find((x: any) => x.id === pid);
                            if (!p) return null;
                            return (
                              <Badge key={pid} variant="secondary" className="text-[10px] cursor-pointer" onClick={() => togglePersonnel(pid)}>
                                {(p as any).prefix || ""}{(p as any).first_name} {(p as any).last_name} ✕
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {filteredPersonnel.map((p: any) => (
                          <label key={p.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                            <Checkbox checked={selectedPersonnel.includes(p.id)} onCheckedChange={() => togglePersonnel(p.id)} />
                            <span>{p.prefix || ""}{p.first_name} {p.last_name}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto">{p.department}</Badge>
                          </label>
                        ))}
                        {filteredPersonnel.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">ไม่พบบุคลากร</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label>หมายเหตุ</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)" className="min-h-[60px]" />
                </div>

                <Button onClick={handleAdd} className="w-full" disabled={uploading}>
                  <Send className="w-4 h-4 mr-2" />
                  {uploading ? "กำลังอัปโหลด..." : "บันทึกและส่งเอกสาร"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาเลขที่/เรื่อง/หน่วยงาน..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(v === "all" ? "all" : Number(v))}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="ปีการศึกษา" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกปีการศึกษา</SelectItem>
            {availableYears.map(y => (
              <SelectItem key={y} value={String(y)}>ปี พ.ศ. {toBE(y)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่</TableHead>
                <TableHead>เรื่อง</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>จาก</TableHead>
                <TableHead>ส่งถึง</TableHead>
                <TableHead>ไฟล์</TableHead>
                <TableHead>วันที่</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.filter((r: any) => {
                if (isAdmin || isDirector) return true;
                // Teachers: show only docs they created or are recipients of
                if (r.created_by === currentUserId) return true;
                return recipients.some((rec: any) => rec.document_id === r.id && rec.recipient_user_id === currentUserId);
              }).filter((r: any) => {
                // Year filter
                if (selectedYear !== "all") {
                  const y = new Date(r.doc_date || r.created_at).getFullYear();
                  if (y !== selectedYear) return false;
                }
                // Search
                if (searchTerm) {
                  const t = searchTerm.toLowerCase();
                  if (!`${r.doc_number} ${r.title} ${r.from_department} ${r.to_department}`.toLowerCase().includes(t)) return false;
                }
                return true;
              }).map((r: any) => {
                const docRecipients = getRecipientsForDoc(r.id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.doc_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{r.title}</p>
                        {r.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{r.notes}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{docTypeLabels[r.doc_type] || r.doc_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.from_department || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {docRecipients.length > 0 ? docRecipients.map((rec: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px] flex items-center gap-1">
                            {rec.is_read && <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />}
                            {rec.recipient_name}
                          </Badge>
                        )) : (
                          <span className="text-xs text-muted-foreground">{r.to_department || "—"}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.file_url ? (
                        <button onClick={() => downloadFile(r.file_url, r.file_name)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Download className="w-3 h-3" />
                          <span className="truncate max-w-[80px]">{r.file_name || "ดาวน์โหลด"}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {/* Show replies summary for sender/admin */}
                      {(isAdmin || isDirector || r.created_by === currentUserId) && (() => {
                        const replies = docRecipients.filter((rc: any) => rc.replied_at);
                        if (replies.length === 0) return null;
                        return (
                          <div className="mt-1 space-y-0.5">
                            {replies.map((rc: any) => (
                              <div key={rc.id} className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Reply className="w-2.5 h-2.5 text-green-600" />
                                <span className="truncate max-w-[120px]">{rc.recipient_name}</span>
                                {rc.reply_file_url && (
                                  <button onClick={() => downloadFile(rc.reply_file_url, rc.reply_file_name)} className="text-primary hover:underline">
                                    📎
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.doc_date}</TableCell>
                    <TableCell>
                      {(isAdmin || isDirector) ? (
                        <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v)}>
                          <SelectTrigger className="h-7 text-xs w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{statusLabels.pending}</SelectItem>
                            <SelectItem value="in_progress">{statusLabels.in_progress}</SelectItem>
                            <SelectItem value="completed">{statusLabels.completed}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={
                          r.status === "completed" ? "bg-green-100 text-green-800" :
                          r.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                          "bg-yellow-100 text-yellow-800"
                        }>
                          {statusLabels[r.status] || r.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Reply button: visible to recipient */}
                        {(() => {
                          const myRec = docRecipients.find((rc: any) => rc.recipient_user_id === currentUserId);
                          if (!myRec) return null;
                          return (
                            <Button variant="ghost" size="sm" onClick={() => openReply(myRec)} title="ตอบกลับ">
                              <Reply className={`w-4 h-4 ${myRec.replied_at ? "text-green-600" : "text-primary"}`} />
                            </Button>
                          );
                        })()}
                        {(isAdmin || isDirector) && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    ไม่มีเอกสาร
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="w-5 h-5 text-primary" />
              ตอบกลับเอกสาร
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ข้อความตอบกลับ</Label>
              <Textarea
                value={replyMessage}
                onChange={e => setReplyMessage(e.target.value)}
                placeholder="พิมพ์ข้อความตอบกลับ..."
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2 border border-border rounded-lg p-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" /> แนบไฟล์ตอบกลับ (ถ้ามี)
              </Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => replyFileInputRef.current?.click()}>
                  <Paperclip className="w-3 h-3 mr-1" /> เลือกไฟล์
                </Button>
                <input
                  ref={replyFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={e => setReplyFile(e.target.files?.[0] || null)}
                />
                {replyFile && (
                  <div className="flex items-center gap-2 text-sm">
                    <File className="w-3 h-3 text-primary" />
                    <span className="truncate max-w-[180px]">{replyFile.name}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setReplyFile(null)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                )}
                {!replyFile && replyRecipient?.reply_file_name && (
                  <span className="text-xs text-muted-foreground">ไฟล์เดิม: {replyRecipient.reply_file_name}</span>
                )}
              </div>
            </div>
            <Button onClick={handleSendReply} disabled={replyUploading} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              {replyUploading ? "กำลังส่ง..." : "ส่งคำตอบ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentPage;
