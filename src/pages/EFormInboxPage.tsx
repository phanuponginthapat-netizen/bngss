import { useState } from "react";
import DOMPurify from "dompurify";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Inbox, Send, CheckCircle2, PenLine, XCircle, Paperclip, Download, History, FileEdit } from "lucide-react";
import { EFormStatusBadge } from "@/components/eform/EFormStatusBadge";
import { useUserRole } from "@/hooks/useUserRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { isDataUrl, openDataUrl } from "@/lib/uploadFallback";
import { BEDatePicker } from "@/components/ui/be-date-picker";

const fmtDate = (d: string) => new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

const recipientStatusBadge = (s: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "ยังไม่อ่าน", cls: "bg-warning-soft text-warning" },
    read: { label: "อ่านแล้ว", cls: "bg-info-soft text-info" },
    replied: { label: "ตอบกลับแล้ว", cls: "bg-info-soft text-info" },
    signed: { label: "ลงนามแล้ว", cls: "bg-success-soft text-success" },
    rejected: { label: "ปฏิเสธ", cls: "bg-danger-soft text-danger" },
  };
  const m = map[s] || map.pending;
  return <Badge className={m.cls}>{m.label}</Badge>;
};

const EFormInboxPage = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openItem, setOpenItem] = useState<any | null>(null);
  const [reply, setReply] = useState("");
  const [signature, setSignature] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partyFilter, setPartyFilter] = useState(""); // sender or recipient name

  const matchesFilters = (eform: any, partyText: string, dateStr: string, recipientStatus?: string) => {
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!`${eform?.title || ""} ${eform?.sender_name || ""}`.toLowerCase().includes(s)) return false;
    }
    if (statusFilter !== "all") {
      // For inbox items use the recipient status if provided; otherwise match against eform.status
      const candidate = recipientStatus ?? eform?.status;
      if (candidate !== statusFilter) return false;
    }
    if (partyFilter.trim() && !partyText.toLowerCase().includes(partyFilter.toLowerCase())) return false;
    if (dateFrom && new Date(dateStr) < new Date(dateFrom)) return false;
    if (dateTo && new Date(dateStr) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  };

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); setPartyFilter("");
  };
  const hasFilters = search || statusFilter !== "all" || dateFrom || dateTo || partyFilter;

  const { userId } = useUserRole();

  const { data: inbox = [] } = useQuery({
    queryKey: ["eform-inbox", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eform_recipients")
        .select("*, eforms(*)")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sent = [] } = useQuery({
    queryKey: ["eform-sent", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eforms")
        .select("*, eform_recipients(id, recipient_name, recipient_role, status, read_at, signed_at, replied_at, rejected_at)")
        .eq("sender_id", userId)
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: drafts = [] } = useQuery({
    queryKey: ["eform-drafts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("eforms")
        .select("*")
        .eq("sender_id", userId)
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["eform-attachments", openItem?.eforms?.id || openItem?.id],
    enabled: !!openItem,
    queryFn: async () => {
      const eformId = openItem?.eforms?.id || openItem?.id;
      const { data } = await supabase
        .from("eform_attachments")
        .select("*")
        .eq("eform_id", eformId);
      return data ?? [];
    },
  });

  const openDetail = async (item: any) => {
    setOpenItem(item);
    setReply(item.reply_text || "");
    setSignature(item.signature_text || "");
    setRejectReason("");
    setShowReject(false);
    if (!item.read_at && item.recipient_id) {
      await supabase
        .from("eform_recipients")
        .update({ read_at: new Date().toISOString(), status: item.status === "pending" ? "read" : item.status })
        .eq("id", item.id);
      qc.invalidateQueries({ queryKey: ["eform-inbox"] });
    }
  };

  const downloadAttachment = async (a: any) => {
    if (isDataUrl(a.file_path)) {
      openDataUrl(a.file_path, a.file_name);
      return;
    }
    const { data, error } = await supabase.storage
      .from("eform-attachments")
      .createSignedUrl(a.file_path, 60);
    if (error) return toast({ title: "ดาวน์โหลดไม่สำเร็จ", description: error.message, variant: "destructive" });
    window.open(data.signedUrl, "_blank");
  };

  const handleReply = async () => {
    if (!openItem) return;
    const { error } = await supabase
      .from("eform_recipients")
      .update({ reply_text: reply, replied_at: new Date().toISOString(), status: "replied" })
      .eq("id", openItem.id);
    if (error) return toast({ title: "ตอบกลับไม่สำเร็จ", description: error.message, variant: "destructive" });
    toast({ title: "ส่งคำตอบแล้ว" });
    qc.invalidateQueries({ queryKey: ["eform-inbox"] });
    setOpenItem(null);
  };

  const handleSign = async () => {
    if (!openItem || !signature.trim()) {
      toast({ title: "กรุณาพิมพ์ชื่อเพื่อลงนาม", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("eform_recipients")
      .update({ signature_text: signature, signed_at: new Date().toISOString(), status: "signed" })
      .eq("id", openItem.id);
    if (error) return toast({ title: "ลงนามไม่สำเร็จ", description: error.message, variant: "destructive" });

    // If all recipients have signed/replied/rejected, advance the parent eform to completed
    const eformId = openItem?.eforms?.id;
    if (eformId) {
      const { data: peers } = await supabase
        .from("eform_recipients")
        .select("status")
        .eq("eform_id", eformId);
      const allDone = (peers ?? []).every((r: any) => ["signed", "replied", "rejected"].includes(r.status));
      if (allDone && (peers?.length ?? 0) > 0) {
        await supabase.from("eforms").update({ status: "completed" } as any).eq("id", eformId);
      }
    }

    toast({ title: "ลงนามอิเล็กทรอนิกส์สำเร็จ" });
    qc.invalidateQueries({ queryKey: ["eform-inbox"] });
    qc.invalidateQueries({ queryKey: ["eform-sent"] });
    setOpenItem(null);
  };

  const handleReject = async () => {
    if (!openItem || !rejectReason.trim()) {
      toast({ title: "กรุณาระบุเหตุผล", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("eform_recipients")
      .update({
        rejected_at: new Date().toISOString(),
        reject_reason: rejectReason,
        status: "rejected",
      })
      .eq("id", openItem.id);
    if (error) return toast({ title: "ปฏิเสธไม่สำเร็จ", description: error.message, variant: "destructive" });
    toast({ title: "ปฏิเสธเอกสารแล้ว" });
    qc.invalidateQueries({ queryKey: ["eform-inbox"] });
    setOpenItem(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Inbox className="w-6 h-6" /> กล่องเอกสาร E-Form
        </h1>
        <p className="text-sm text-muted-foreground">เอกสารที่ส่งถึงคุณ ที่คุณส่งออก ร่าง และประวัติการดำเนินการ</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="ค้นหาชื่อเอกสาร / ผู้ส่ง" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="สถานะ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="draft">ร่าง</SelectItem>
              <SelectItem value="sent">ส่งแล้ว</SelectItem>
              <SelectItem value="pending">ยังไม่อ่าน (กล่องเข้า)</SelectItem>
              <SelectItem value="read">อ่านแล้ว (กล่องเข้า)</SelectItem>
              <SelectItem value="replied">ตอบกลับแล้ว (กล่องเข้า)</SelectItem>
              <SelectItem value="signed">ลงนามแล้ว (กล่องเข้า)</SelectItem>
              <SelectItem value="pending_signature">รอลงนาม</SelectItem>
              <SelectItem value="completed">เสร็จสมบูรณ์</SelectItem>
              <SelectItem value="rejected">ปฏิเสธ</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="ผู้ส่ง / ผู้รับ" value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)} />
          <div className="flex gap-2">
            <BEDatePicker value={dateFrom} onChange={(v) => setDateFrom(v)} />
            <BEDatePicker value={dateTo} onChange={(v) => setDateTo(v)} />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="md:col-span-5 justify-self-end">
              <X className="w-4 h-4 mr-1" /> ล้างตัวกรอง
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1"><Inbox className="w-4 h-4" /> ขาเข้า</TabsTrigger>
          <TabsTrigger value="sent" className="gap-1"><Send className="w-4 h-4" /> ส่งออก</TabsTrigger>
          <TabsTrigger value="drafts" className="gap-1"><FileEdit className="w-4 h-4" /> ร่าง ({drafts.length})</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><History className="w-4 h-4" /> ประวัติ</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-2">
          {(() => {
            const filtered = inbox.filter((item: any) =>
              matchesFilters(item.eforms, item.eforms?.sender_name || "", item.created_at, item.status)
            );
            if (filtered.length === 0) return (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{hasFilters ? "ไม่พบเอกสารตามตัวกรอง" : "ยังไม่มีเอกสารส่งถึงคุณ"}</CardContent></Card>
            );
            return filtered.map((item: any) => (
            <Card key={item.id} className={`cursor-pointer hover:shadow-md transition ${!item.read_at ? "border-primary/50 bg-primary/5" : ""}`} onClick={() => openDetail(item)}>
              <CardContent className="p-4 flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{item.eforms?.title}</p>
                    <EFormStatusBadge status={item.eforms?.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">จาก {item.eforms?.sender_name || "-"} • {fmtDate(item.created_at)}</p>
                </div>
                {recipientStatusBadge(item.status)}
              </CardContent>
            </Card>
            ));
          })()}
        </TabsContent>

        <TabsContent value="sent" className="space-y-2">
          {(() => {
            const filtered = sent.filter((eform: any) => {
              const recipientNames = (eform.eform_recipients || []).map((r: any) => r.recipient_name || "").join(" ");
              return matchesFilters(eform, recipientNames, eform.created_at);
            });
            if (filtered.length === 0) return (
              <Card><CardContent className="p-8 text-center text-muted-foreground">{hasFilters ? "ไม่พบเอกสารตามตัวกรอง" : "ยังไม่ได้ส่งเอกสารใด"}</CardContent></Card>
            );
            return filtered.map((eform: any) => {
              const recs = eform.eform_recipients || [];
              const signed = recs.filter((r: any) => r.signed_at).length;
              const read = recs.filter((r: any) => r.read_at).length;
              const rejected = recs.filter((r: any) => r.rejected_at).length;
              return (
                <Card key={eform.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-base">{eform.title}</CardTitle>
                      <EFormStatusBadge status={eform.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtDate(eform.created_at)} • ผู้รับ {recs.length} คน{recs.length > 0 ? ` (${recs.slice(0, 3).map((r: any) => r.recipient_name).join(", ")}${recs.length > 3 ? "..." : ""})` : ""}</p>
                  </CardHeader>
                  <CardContent className="pb-4 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">อ่านแล้ว {read}/{recs.length}</Badge>
                    <Badge variant="outline" className="bg-success-soft">ลงนาม {signed}/{recs.length}</Badge>
                    {rejected > 0 && <Badge variant="outline" className="bg-danger-soft">ปฏิเสธ {rejected}</Badge>}
                  </CardContent>
                </Card>
              );
            });
          })()}
        </TabsContent>

        <TabsContent value="drafts" className="space-y-2">
          {drafts.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">ไม่มีร่างเอกสาร</CardContent></Card>
          )}
          {drafts.map((d: any) => (
            <Card key={d.id} className="cursor-pointer hover:shadow-md" onClick={() => setOpenItem({ ...d, eforms: d })}>
              <CardContent className="p-4 flex items-center gap-3">
                <FileEdit className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{d.title}</p>
                    <EFormStatusBadge status="draft" />
                  </div>
                  <p className="text-xs text-muted-foreground">บันทึก {fmtDate(d.created_at)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {[...sent, ...inbox.map((i: any) => ({ ...i.eforms, _via: "received", _action: i }))]
            .filter(Boolean)
            .filter((e: any) => matchesFilters(e, e._via === "received" ? (e.sender_name || "") : (e.eform_recipients || []).map((r: any) => r.recipient_name).join(" "), e.created_at))
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((e: any, idx: number) => (
              <Card key={`${e.id}-${idx}`}>
                <CardContent className="p-3 flex items-center gap-2 text-sm">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)} • {e._via === "received" ? `ได้รับจาก ${e.sender_name || "-"}` : "ส่งออก"}</p>
                  </div>
                  <EFormStatusBadge status={e.status} />
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!openItem} onOpenChange={(v) => !v && setOpenItem(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle>{openItem?.eforms?.title}</DialogTitle>
              {openItem?.eforms?.status && <EFormStatusBadge status={openItem.eforms.status} />}
            </div>
            <p className="text-xs text-muted-foreground">จาก {openItem?.eforms?.sender_name} • {openItem && fmtDate(openItem.created_at)}</p>
          </DialogHeader>

          {openItem && (
            <div className="space-y-4">
              <div className="border rounded-md bg-white text-black p-4 max-h-[400px] overflow-y-auto" style={{ fontFamily: "'TH Sarabun New', 'Sarabun', sans-serif" }}>
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(openItem.eforms?.content_html || "") }} />
              </div>

              {attachments.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-sm flex items-center gap-1"><Paperclip className="w-4 h-4" /> ไฟล์แนบ ({attachments.length})</Label>
                  {attachments.map((a: any) => (
                    <button
                      key={a.id}
                      onClick={() => downloadAttachment(a)}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted text-sm"
                    >
                      <Download className="w-4 h-4 text-primary" />
                      <span className="flex-1 truncate">{a.file_name}</span>
                      <span className="text-xs text-muted-foreground">{a.file_size ? `${(a.file_size/1024).toFixed(0)} KB` : ""}</span>
                    </button>
                  ))}
                </div>
              )}

              {openItem.recipient_id && openItem.eforms?.status !== "rejected" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">ตอบกลับ (ถ้ามี)</Label>
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="พิมพ์คำตอบหรือความเห็น..." rows={3} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-1"><PenLine className="w-4 h-4" /> ลงนามอิเล็กทรอนิกส์</Label>
                    <Input
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      placeholder="พิมพ์ชื่อ-นามสกุลเพื่อลงนาม"
                      disabled={!!openItem.signed_at}
                    />
                    {openItem.signed_at && (
                      <p className="text-xs text-success flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> ลงนามเมื่อ {fmtDate(openItem.signed_at)}
                      </p>
                    )}
                  </div>

                  {showReject && (
                    <div className="space-y-2 p-3 border border-destructive/30 bg-destructive/5 rounded-md">
                      <Label className="text-sm text-destructive">เหตุผลการปฏิเสธ</Label>
                      <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="ระบุเหตุผล..." />
                    </div>
                  )}
                </>
              )}

              {openItem.rejected_at && (
                <div className="p-3 bg-danger-soft border border-danger/30 rounded-md text-sm text-danger">
                  <p className="font-medium flex items-center gap-1"><XCircle className="w-4 h-4" /> ปฏิเสธแล้ว</p>
                  <p className="text-xs mt-1">เหตุผล: {openItem.reject_reason || "-"}</p>
                </div>
              )}
            </div>
          )}

          {openItem?.recipient_id && openItem.eforms?.status !== "rejected" && !openItem.rejected_at && (
            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setOpenItem(null)}>ปิด</Button>
              {!showReject ? (
                <Button variant="destructive" onClick={() => setShowReject(true)}>
                  <XCircle className="w-4 h-4 mr-1" /> ปฏิเสธ
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
                  ยืนยันปฏิเสธ
                </Button>
              )}
              <Button variant="secondary" onClick={handleReply} disabled={!reply.trim()}>
                <Send className="w-4 h-4 mr-1" /> ส่งคำตอบ
              </Button>
              <Button onClick={handleSign} disabled={!signature.trim() || !!openItem?.signed_at}>
                <PenLine className="w-4 h-4 mr-1" /> ลงนาม
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EFormInboxPage;
