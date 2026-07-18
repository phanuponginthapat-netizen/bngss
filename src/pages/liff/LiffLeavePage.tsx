import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import LiffShell from "./LiffShell";
import { uploadLeaveAttachment } from "@/lib/leaveAttachment";
import { Paperclip } from "lucide-react";

function LeaveForm({ lineUserId }: { lineUserId: string }) {
  const [type, setType] = useState("sick");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!start || !end || !reason.trim()) return toast.error("กรอกข้อมูลให้ครบ");
    setBusy(true);
    try {
      // อัปโหลดไฟล์แนบ (ถ้ามี) ก่อน — ใช้ lineUserId เป็น folder ชั่วคราว
      let attachmentPath: string | null = null;
      if (attachment) {
        try {
          attachmentPath = await uploadLeaveAttachment(attachment, lineUserId);
        } catch (e) {
          console.warn("upload attachment failed, continuing without it", e);
        }
      }

      // ส่งไป edge function (service role) — bypass RLS เพราะ LIFF ไม่มี Supabase session
      // ส่ง LINE access token ผ่าน Authorization header ให้ฝั่ง server ตรวจสอบและดึง userId เอง
      const lineAccessToken: string = (window as any).liff?.getAccessToken?.() || "";
      if (!lineAccessToken) throw new Error("ยังไม่ได้ล็อกอิน LINE");
      const { data, error } = await supabase.functions.invoke("liff-submit-leave", {
        headers: { Authorization: `Bearer ${lineAccessToken}` },
        body: {
          leave_type: type,
          start_date: start,
          end_date: end,
          reason,
          attachment_url: attachmentPath,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success("ส่งใบลาเรียบร้อย");
      setTimeout(() => (window as any).liff?.closeWindow?.(), 800);
    } catch (e: any) {
      toast.error(e.message || "ส่งใบลาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div>
        <Label>ประเภท</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sick">ลาป่วย</SelectItem>
            <SelectItem value="personal">ลากิจ</SelectItem>
            <SelectItem value="annual">ลาพักร้อน</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>วันที่เริ่ม</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><Label>วันที่สิ้นสุด</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <div>
        <Label>เหตุผล</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
      </div>
      <div>
        <Label className="flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" />ไฟล์/รูปแนบ (ถ้ามี)</Label>
        <Input type="file" accept="image/*,application/pdf" onChange={(e) => setAttachment(e.target.files?.[0] || null)} />
        {attachment && <p className="text-xs text-muted-foreground mt-1">{attachment.name}</p>}
      </div>
      <Button onClick={submit} disabled={busy} className="w-full">
        {busy ? "กำลังส่ง..." : "ส่งใบลา"}
      </Button>
    </div>
  );
}

export default function LiffLeavePage() {
  return <LiffShell title="📝 ยื่นใบลา">{(uid) => <LeaveForm lineUserId={uid} />}</LiffShell>;
}
