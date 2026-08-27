import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox, CheckCheck, Trash2, AlertTriangle, FileText, Bell, ClipboardCheck, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";
import { routeForNotification } from "@/lib/notificationRoute";

const EFormInboxPage = lazy(() => import("./EFormInboxPage"));
const DocumentInboxPage = lazy(() => import("./DocumentInboxPage"));

type UnifiedItem = {
  id: string;
  source: "notification" | "inbox";
  title: string;
  message: string | null;
  item_type: string;
  category: string | null;
  is_read: boolean;
  priority: string;
  action_url: string | null;
  created_at: string;
  reference_table: string | null;
  reference_id: string | null;
};

const priorityColor: Record<string, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  normal: "bg-primary/10 text-primary",
  low: "bg-muted text-muted-foreground",
};

const typeIcon: Record<string, any> = {
  notification: Bell,
  document: FileText,
  approval: ClipboardCheck,
  task: CheckCheck,
};

export default function InboxPage() {
  const { userId, role } = useUserRole();
  const canUseEForm = role === "admin" || role === "director" || role === "teacher";
  const canUseDocuments = !!role;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTopTab = searchParams.get("tab") === "eform" ? "eform" : searchParams.get("tab") === "documents" ? "documents" : "messages";
  const [topTab, setTopTab] = useState<"messages" | "documents" | "eform">(initialTopTab);
  const [tab, setTab] = useState<"all" | "unread">("all");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "eform" || t === "documents" || t === "messages") setTopTab(t);
  }, [searchParams]);


  const { data: inboxRows = [], isLoading: l1 } = useQuery({
    queryKey: ["inbox_items_all", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("inbox_items")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const { data: notifRows = [], isLoading: l2 } = useQuery({
    queryKey: ["notifications_all", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("inbox-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_items", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["inbox_items_all"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications_all"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  const items: UnifiedItem[] = useMemo(() => {
    const a: UnifiedItem[] = (inboxRows as any[]).map(r => ({
      id: r.id, source: "inbox",
      title: r.title, message: r.message,
      item_type: r.item_type || "notification",
      category: r.category,
      is_read: r.is_read,
      priority: r.priority || "normal",
      action_url: r.action_url,
      created_at: r.created_at,
      reference_table: r.reference_table,
      reference_id: r.reference_id,
    }));
    const inboxNotifIds = new Set((inboxRows as any[]).map((r: any) => r.notification_id).filter(Boolean));
    const b: UnifiedItem[] = (notifRows as any[])
      .filter(r => !inboxNotifIds.has(r.id))
      .map(r => ({
        id: r.id, source: "notification",
        title: r.title, message: r.message,
        item_type: r.type || "notification",
        category: null,
        is_read: !!r.is_read,
        priority: "normal",
        action_url: null,
        created_at: r.created_at,
        reference_table: r.reference_type || null,
        reference_id: r.reference_id || null,
      }));
    return [...a, ...b].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
  }, [inboxRows, notifRows]);

  const filtered = tab === "unread" ? items.filter(i => !i.is_read) : items;
  const unreadCount = items.filter(i => !i.is_read).length;
  const isLoading = l1 || l2;

  const markRead = useMutation({
    mutationFn: async (it: UnifiedItem) => {
      if (it.source === "inbox") {
        await supabase.from("inbox_items").update({ is_read: true }).eq("id", it.id);
      } else {
        await supabase.from("notifications").update({ is_read: true }).eq("id", it.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox_items_all"] });
      qc.invalidateQueries({ queryKey: ["notifications_all"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      // ลำดับคงที่ (notifications ก่อน inbox_items) เพื่อกัน deadlock เวลาอัปเดตพร้อมกัน
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId!).eq("is_read", false);
      await supabase.from("inbox_items").update({ is_read: true }).eq("user_id", userId!).eq("is_read", false);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox_items_all"] });
      qc.invalidateQueries({ queryKey: ["notifications_all"] });
      toast.success("ทำเครื่องหมายอ่านแล้วทั้งหมด");
    },
  });

  const remove = useMutation({
    mutationFn: async (it: UnifiedItem) => {
      const table = it.source === "inbox" ? "inbox_items" : "notifications";
      await supabase.from(table).delete().eq("id", it.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbox_items_all"] });
      qc.invalidateQueries({ queryKey: ["notifications_all"] });
      toast.success("ลบแล้ว");
    },
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="w-6 h-6" /> กล่องข้อความรวม
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-6 min-w-6 px-2 rounded-full">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            รวมแจ้งเตือน คำขออนุมัติ และเอกสาร E-Form ทั้งหมดในที่เดียว
          </p>
        </div>
        {topTab === "messages" && unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="w-4 h-4 mr-2" /> อ่านทั้งหมด
          </Button>
        )}
      </div>

      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as any)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="messages" className="gap-1.5">
            <Bell className="w-4 h-4" /> แจ้งเตือน
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 rounded-full text-[10px]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          {canUseDocuments && (
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="w-4 h-4" /> เอกสารรับ
            </TabsTrigger>
          )}
          {canUseEForm && (
            <TabsTrigger value="eform" className="gap-1.5">
              <Mail className="w-4 h-4" /> E-Form
            </TabsTrigger>
          )}
        </TabsList>

        {canUseDocuments && (
          <TabsContent value="documents" className="mt-4">
            <Suspense fallback={<div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>}>
              <DocumentInboxPage />
            </Suspense>
          </TabsContent>
        )}

        {canUseEForm && (
          <TabsContent value="eform" className="mt-4">
            <Suspense fallback={<div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>}>
              <EFormInboxPage />
            </Suspense>
          </TabsContent>
        )}


        <TabsContent value="messages" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                  <TabsTrigger value="unread">
                    ยังไม่อ่าน
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 rounded-full text-[10px]">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{tab === "unread" ? "อ่านครบทุกข้อความแล้ว" : "ไม่มีข้อความ"}</p>
                </div>
              ) : (
                <div className="pr-1">
                  <div className="space-y-1">
                    {filtered.map(item => {
                      const Icon = typeIcon[item.item_type] || Bell;
                      const unread = !item.is_read;
                      return (
                        <div
                          key={`${item.source}-${item.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (unread) markRead.mutate(item);
                            const r = routeForNotification(item as any, role);
                            if (r) navigate(r);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLDivElement).click();
                          }}
                          className={`group relative flex gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                            unread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/60"
                          }`}
                        >
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                              unread ? (priorityColor[item.priority] || priorityColor.normal) : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {item.priority === "urgent" ? <AlertTriangle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm ${unread ? "font-semibold text-foreground" : "font-normal text-muted-foreground"}`}>
                                {item.title}
                              </p>
                              {item.category && <Badge variant="outline" className="text-xs">{item.category}</Badge>}
                            </div>
                            {item.message && (
                              <p className={`text-xs mt-0.5 line-clamp-2 ${unread ? "text-foreground/80" : "text-muted-foreground/70"}`}>
                                {item.message}
                              </p>
                            )}
                            <p className={`text-xs mt-1 ${unread ? "text-primary font-medium" : "text-muted-foreground/60"}`}>
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: th })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {unread && (
                              <span className="w-2.5 h-2.5 rounded-full bg-primary" aria-label="ยังไม่อ่าน" />
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                              onClick={(e) => { e.stopPropagation(); remove.mutate(item); }}
                              title="ลบ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
