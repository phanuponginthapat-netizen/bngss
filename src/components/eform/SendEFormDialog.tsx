import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Send, Search, Paperclip, X, Save, FileEdit } from "lucide-react";
import { uploadPrivateFileWithFallback } from "@/lib/uploadFallback";
import RichDocEditor from "@/components/editor/RichDocEditor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  contentHtml: string;
  templateId?: string;
  category?: string;
  formData?: Record<string, string>;
  urgency?: string;
  initialFiles?: File[];
}


interface Recipient {
  user_id: string;
  full_name: string;
  role: string;
}

export const SendEFormDialog = ({ open, onOpenChange, title, contentHtml, templateId, category, formData, urgency, initialFiles }: Props) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [busy, setBusy] = useState(false);
  const [editedHtml, setEditedHtml] = useState(contentHtml);
  useEffect(() => {
    if (open) {
      setEditedHtml(contentHtml);
      if (initialFiles?.length) setFiles(initialFiles);
    }
  }, [open, initialFiles, contentHtml]);



  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["eform-recipients-list"],
    enabled: open,
    queryFn: async (): Promise<Recipient[]> => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["teacher", "director", "admin"] as any);
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await (supabase.rpc as any)("get_profiles_public", { _ids: ids });
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return (roles ?? []).map((r: any) => {
        const p: any = profileMap.get(r.user_id);
        const full = p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "(ไม่มีชื่อ)";
        return { user_id: r.user_id, full_name: full || "(ไม่มีชื่อ)", role: r.role };
      });
    },
  });

  const filtered = recipients.filter(
    (r) => r.full_name.toLowerCase().includes(search.toLowerCase()) || r.role.includes(search)
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.user_id)));
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...list]);
    e.target.value = "";
  };
  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const persist = async (status: "draft" | "sent") => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (status === "sent" && selected.size === 0) {
        toast({ title: "กรุณาเลือกผู้รับ", variant: "destructive" });
        setBusy(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
      const senderName = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() : user.email;

      const { data: eform, error: eformErr } = await supabase
        .from("eforms")
        .insert({
          sender_id: user.id,
          sender_name: senderName,
          title,
          content_html: editedHtml,
          template_id: templateId,
          category,
          form_data: formData ?? {},
          urgency: urgency || "normal",
          status,
        })
        .select().single();
      if (eformErr) throw eformErr;

      // Upload attachments
      for (const f of files) {
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const upload = await uploadPrivateFileWithFallback("eform-attachments", `${eform.id}/${Date.now()}-${safeName}`, f);
        const { error: attachErr } = await supabase.from("eform_attachments").insert({
          eform_id: eform.id,
          file_name: f.name,
          file_path: upload.path,
          file_size: f.size,
          mime_type: f.type,
          uploaded_by: user.id,
        });
        if (attachErr) throw attachErr;
      }

      if (status === "sent") {
        const rows = Array.from(selected).map((rid) => {
          const rec = recipients.find((r) => r.user_id === rid);
          return {
            eform_id: eform.id,
            recipient_id: rid,
            recipient_name: rec?.full_name,
            recipient_role: rec?.role,
          };
        });
        const { error: recErr } = await supabase.from("eform_recipients").insert(rows);
        if (recErr) throw recErr;

        // === Saraban register: บันทึกเข้าทะเบียนสารบรรณอัตโนมัติ ===
        try {
          const toDept = rows.map((r) => r.recipient_name).filter(Boolean).join(", ");
          await supabase.from("saraban_documents").insert({
            direction: "internal",
            doc_no: `EFORM-${eform.id.slice(0, 8).toUpperCase()}`,
            doc_date: new Date().toISOString().slice(0, 10),
            subject: title,
            from_org: senderName || "ระบบ",
            to_dept: toDept || null,
            urgency: urgency || "normal",
            secrecy: "normal",
            status: "received",
            created_by: user.id,
            notes: `อ้างอิง E-Form: ${eform.id}`,
          });
        } catch (sErr) {
          console.warn("[saraban] auto-register failed:", sErr);
        }

        // Fan-out notification to recipients (in-app + push + LINE)
        await notify({
          user_ids: Array.from(selected),
          title: `📄 เอกสารใหม่: ${title}`,
          body: `กรุณาตรวจสอบและลงนาม`,
          type: "eform",
          severity: "info",
          reference_id: eform.id,
          reference_type: "eforms",
          url: "/dashboard/inbox",
          channels: ["in_app", "push", "line"],
        });
      }

      toast({
        title: status === "draft" ? "บันทึกร่างแล้ว" : "ส่งเอกสารสำเร็จ",
        description: status === "sent" ? `ส่งให้ผู้รับ ${selected.size} คน` : undefined,
      });
      setSelected(new Set());
      setFiles([]);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ส่งเอกสารในระบบ — {title}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="edit" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="edit"><FileEdit className="w-4 h-4 mr-1" />แก้ไขเอกสาร</TabsTrigger>
            <TabsTrigger value="send"><Send className="w-4 h-4 mr-1" />ผู้รับ & ส่ง</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-2 mt-3">
            <p className="text-xs text-muted-foreground">ปรับแต่งเนื้อหาเอกสารก่อนส่ง (เครื่องมือครบแบบ Word)</p>
            <RichDocEditor value={editedHtml} onChange={setEditedHtml} minHeight="50vh" />
          </TabsContent>

          <TabsContent value="send" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs flex items-center gap-1"><Paperclip className="w-3 h-3" /> ไฟล์แนบ</Label>
              <Input type="file" multiple onChange={onPickFiles} className="h-9 text-xs" />
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-muted px-2 py-1 rounded">
                      <span className="truncate">{f.name} <span className="text-muted-foreground">({(f.size/1024).toFixed(0)} KB)</span></span>
                      <button onClick={() => removeFile(i)} className="text-destructive ml-2"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="ค้นหาผู้รับ..." className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">เลือกแล้ว {selected.size} / {filtered.length}</span>
              <button onClick={toggleAll} className="text-primary hover:underline">
                {selected.size === filtered.length && filtered.length > 0 ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
              </button>
            </div>
            <ScrollArea className="h-[240px] border rounded-md p-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4 text-center">กำลังโหลด...</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">ไม่พบผู้รับ</p>
              ) : (
                <div className="space-y-1">
                  {filtered.map((r) => (
                    <label key={r.user_id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                      <Checkbox checked={selected.has(r.user_id)} onCheckedChange={() => toggle(r.user_id)} />
                      <div className="flex-1 min-w-0"><p className="text-sm truncate">{r.full_name}</p></div>
                      <Badge variant="outline" className="text-[10px]">{r.role}</Badge>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>ยกเลิก</Button>
          <Button variant="secondary" onClick={() => persist("draft")} disabled={busy}>
            <Save className="w-4 h-4 mr-1" /> บันทึกร่าง
          </Button>
          <Button onClick={() => persist("sent")} disabled={busy || selected.size === 0}>
            <Send className="w-4 h-4 mr-1" />
            {busy ? "กำลังส่ง..." : `ส่ง (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
