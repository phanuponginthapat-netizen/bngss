import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Inbox, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { isDataUrl, openDataUrl } from "@/lib/uploadFallback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type DocumentRecord = {
  id: string;
  doc_number: string;
  title: string;
  from_department: string | null;
  to_department: string | null;
  doc_date: string;
  doc_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  file_url: string | null;
  file_name: string | null;
  created_by: string | null;
  _recipientId?: string | null;
  _recipientName?: string | null;
  _recipientType?: string | null;
  _isRead?: boolean;
  _readAt?: string | null;
  _replyMessage?: string | null;
  _replyFileUrl?: string | null;
  _replyFileName?: string | null;
};

const fmtDate = (d?: string | null) => {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
};

export default function DocumentInboxPage() {
  const { userId, role } = useUserRole();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openDoc, setOpenDoc] = useState<DocumentRecord | null>(null);

  const isLeader = role === "admin" || role === "director";

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["document-inbox-rows", userId, role],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_recipients" as any)
        .select("*, documents(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const documents = useMemo<DocumentRecord[]>(() => {
    const map = new Map<string, DocumentRecord>();

    for (const row of rows as any[]) {
      const doc = row.documents;
      if (!doc?.id) continue;

      // RLS already limits department recipient rows to users in that department.
      // Keep department rows here too; otherwise documents sent to a wholeฝ่าย/งาน
      // are fetched successfully from the backend but hidden by this client filter.
      const isDirectRecipient = row.recipient_user_id === userId;
      const isDepartmentRecipient = row.recipient_type === "department";
      const isSender = doc.created_by === userId;
      if (!isLeader && !isDirectRecipient && !isDepartmentRecipient && !isSender) continue;

      const current = map.get(doc.id);
      const candidate: DocumentRecord = {
        ...doc,
        _recipientId: row.id,
        _recipientName: row.recipient_name,
        _recipientType: row.recipient_type,
        _isRead: !!row.is_read,
        _readAt: row.read_at,
        _replyMessage: row.reply_message,
        _replyFileUrl: row.reply_file_url,
        _replyFileName: row.reply_file_name,
      };

      // Prefer the current user's direct row, then an accessible department row,
      // if several recipients point to the same document.
      if (!current || isDirectRecipient || (!current._recipientId && isDepartmentRecipient)) map.set(doc.id, candidate);
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [rows, userId, isLeader]);

  useEffect(() => {
    const docId = searchParams.get("doc");
    if (!docId || !documents.length) return;
    const match = documents.find((d) => d.id === docId || d._recipientId === docId);
    if (!match) return;
    openDetail(match);
    const sp = new URLSearchParams(searchParams);
    sp.delete("doc");
    setSearchParams(sp, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, documents]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`document-inbox-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => {
        qc.invalidateQueries({ queryKey: ["document-inbox-rows", userId, role] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "document_recipients" }, () => {
        qc.invalidateQueries({ queryKey: ["document-inbox-rows", userId, role] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, role, qc]);

  const openDetail = async (doc: DocumentRecord) => {
    setOpenDoc(doc);
    if (!doc._recipientId || doc._isRead) return;
    const { error } = await supabase
      .from("document_recipients" as any)
      .update({ is_read: true, read_at: new Date().toISOString() } as any)
      .eq("id", doc._recipientId);
    if (!error) qc.invalidateQueries({ queryKey: ["document-inbox-rows", userId, role] });
  };

  const downloadFile = async (pathOrUrl?: string | null, name?: string | null) => {
    if (!pathOrUrl) return;
    if (isDataUrl(pathOrUrl)) {
      openDataUrl(pathOrUrl, name ?? undefined);
      return;
    }
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

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">กำลังโหลดเอกสารที่ได้รับ...</CardContent></Card>;
  }

  if (error) {
    return <Card><CardContent className="p-8 text-center text-destructive">โหลดเอกสารที่ได้รับไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
            ยังไม่มีเอกสารส่งถึงคุณ
          </CardContent>
        </Card>
      ) : (
        <div className="pr-1">
          <div className="space-y-2">
            {documents.map((doc) => {
              const unread = !doc._isRead;
              return (
                <Card
                  key={doc.id}
                  className={`cursor-pointer hover:shadow-md transition ${unread ? "border-primary/50 bg-primary/5" : ""}`}
                  onClick={() => openDetail(doc)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium text-sm truncate ${unread ? "text-foreground" : "text-muted-foreground"}`}>{doc.title}</p>
                        <Badge variant={unread ? "default" : "outline"}>{unread ? "ใหม่" : "อ่านแล้ว"}</Badge>
                        {doc.file_url && <Badge variant="secondary" className="gap-1"><Paperclip className="w-3 h-3" /> แนบไฟล์</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        เลขที่ {doc.doc_number} • จาก {doc.from_department || "-"} • {fmtDate(doc.created_at)}
                      </p>
                    </div>
                    <Badge variant="outline">{doc.status || "pending"}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!openDoc} onOpenChange={(v) => !v && setOpenDoc(null)}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openDoc?.title}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              เลขที่ {openDoc?.doc_number || "-"} • จาก {openDoc?.from_department || "-"} • {fmtDate(openDoc?.created_at)}
            </p>
          </DialogHeader>

          {openDoc && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">ผู้รับ</p>
                  <p className="font-medium">{openDoc._recipientName || openDoc.to_department || "-"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">สถานะ</p>
                  <p className="font-medium">{openDoc._isRead ? "อ่านแล้ว" : "ยังไม่อ่าน"}</p>
                </div>
              </div>

              {openDoc.notes && (
                <div className="rounded-lg border p-3 whitespace-pre-wrap">
                  <p className="text-xs text-muted-foreground mb-1">หมายเหตุ</p>
                  {openDoc.notes}
                </div>
              )}

              {openDoc.file_url && (
                <Button variant="outline" className="w-full justify-start" onClick={() => downloadFile(openDoc.file_url, openDoc.file_name)}>
                  <Download className="w-4 h-4 mr-2" /> เปิดไฟล์แนบ {openDoc.file_name ? `(${openDoc.file_name})` : ""}
                </Button>
              )}

              {openDoc._replyMessage && (
                <div className="rounded-lg border p-3 whitespace-pre-wrap">
                  <p className="text-xs text-muted-foreground mb-1">ข้อความตอบกลับ</p>
                  {openDoc._replyMessage}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}