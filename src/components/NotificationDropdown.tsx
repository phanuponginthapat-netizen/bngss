import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Bell, CheckCheck, FileText, Megaphone, Info, Trash2,
  Mail, ClipboardCheck, AlertTriangle, Inbox as InboxIcon, ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { routeForNotification } from "@/lib/notificationRoute";
import { setAppBadge, setTitleBadge } from "@/lib/liveNotification";



type UnifiedItem = {
  source: "notification" | "inbox";
  id: string;
  title: string;
  message: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
  priority?: string;
  raw: any;
};

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  document: FileText,
  announcement: Megaphone,
  system: Info,
  notification: Bell,
  approval: ClipboardCheck,
  task: CheckCheck,
  eform: Mail,
};

const NotificationDropdown = () => {
  const { userId, isAdmin, isDirector, role } = useUserRole();
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [detail, setDetail] = useState<UnifiedItem | null>(null);

  // Safety: force-close popover and clear any leftover Radix pointer-events
  // lock on the body whenever the route changes (fixes the case where the
  // dropdown appears "stuck" over the new page after clicking an item).
  useEffect(() => {
    setOpen(false);
    setDetail(null);
    if (typeof document !== "undefined") {
      document.body.style.pointerEvents = "";
    }
  }, [location.pathname]);



  const { data: notifications = [] } = useQuery({
    queryKey: ["my_notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    enabled: !!userId,
    refetchInterval: 3 * 60_000, // realtime ครอบอยู่แล้ว — poll เป็น fallback
  });

  const { data: inboxItems = [] } = useQuery({
    queryKey: ["my_inbox_items", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("inbox_items")
        .select("*")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    enabled: !!userId,
    refetchInterval: 3 * 60_000, // realtime ครอบอยู่แล้ว — poll เป็น fallback
  });

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("unified-notifications")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["my_notifications", userId] }))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "inbox_items", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["my_inbox_items", userId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  const merged: UnifiedItem[] = useMemo(() => {
    const inboxNotifIds = new Set(
      (inboxItems as any[]).map((i: any) => i.notification_id).filter(Boolean)
    );
    const b: UnifiedItem[] = (inboxItems as any[]).map((i: any) => ({
      source: "inbox", id: i.id, title: i.title,
      message: i.message, type: i.item_type || "notification",
      is_read: !!i.is_read, created_at: i.created_at,
      priority: i.priority, raw: i,
    }));
    const a: UnifiedItem[] = (notifications as any[])
      .filter((n: any) => !inboxNotifIds.has(n.id))
      .map((n: any) => ({
        source: "notification", id: n.id, title: n.title,
        message: n.message, type: n.type || "system",
        is_read: !!n.is_read, created_at: n.created_at, raw: n,
      }));
    return [...a, ...b].sort((x, y) =>
      new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
    );
  }, [notifications, inboxItems]);

  const unreadCount = merged.filter(i => !i.is_read).length;

  // Reflect unread count on installed PWA icon + browser tab title
  useEffect(() => {
    setAppBadge(unreadCount);
    setTitleBadge(unreadCount);
    return () => { setTitleBadge(0); };
  }, [unreadCount]);

  const visible = tab === "unread" ? merged.filter(i => !i.is_read) : merged;

  const tableFor = (s: UnifiedItem["source"]) =>
    s === "notification" ? "notifications" : "inbox_items";

  const markAsRead = async (item: UnifiedItem) => {
    await (supabase.from(tableFor(item.source)) as any)
      .update({ is_read: true }).eq("id", item.id);
    qc.invalidateQueries({ queryKey: ["my_notifications", userId] });
    qc.invalidateQueries({ queryKey: ["my_inbox_items", userId] });
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    // ลำดับคงที่ (notifications ก่อน inbox_items) เพื่อกัน deadlock
    await (supabase.from("notifications") as any)
      .update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    await (supabase.from("inbox_items") as any)
      .update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["my_notifications", userId] });
    qc.invalidateQueries({ queryKey: ["my_inbox_items", userId] });
  };

  const deleteItem = async (item: UnifiedItem) => {
    await supabase.from(tableFor(item.source) as any).delete().eq("id", item.id);
    qc.invalidateQueries({ queryKey: ["my_notifications", userId] });
    qc.invalidateQueries({ queryKey: ["my_inbox_items", userId] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground relative" title={lang === "th" ? "การแจ้งเตือน" : "Notifications"}>
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(380px,calc(100vw-1rem))] p-0 flex flex-col max-h-[min(560px,calc(100vh-5rem))]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >

        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">
            {lang === "th" ? "การแจ้งเตือน" : "Notifications"}
          </h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
              <CheckCheck className="w-3 h-3 mr-1" />
              {lang === "th" ? "อ่านทั้งหมด" : "Mark all read"}
            </Button>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="px-3 pt-2">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-6">
              {lang === "th" ? "ทั้งหมด" : "All"}
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs h-6">
              {lang === "th" ? "ยังไม่อ่าน" : "Unread"}
              {unreadCount > 0 && <span className="ml-1 text-destructive">({unreadCount})</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        >
          {visible.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {lang === "th" ? "ไม่มีการแจ้งเตือน" : "No notifications"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {visible.map((n) => {
                const Icon = typeIcons[n.type] || Info;
                const isUrgent = n.priority === "urgent";
                return (
                  <div
                    key={`${n.source}-${n.id}`}
                    className={`px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group ${!n.is_read ? "bg-primary/5" : ""}`}
                    onClick={() => {
                      if (!n.is_read) markAsRead(n);
                      const r = routeForNotification(n.raw, role);
                      if (r) {
                        // Navigate first; Popover will unmount as its trigger's
                        // parent tree stays mounted. Closing after nav avoids
                        // Radix pointer-events lock getting stuck when the
                        // target route is lazy-loaded (Suspense fallback).
                        navigate(r);
                        setOpen(false);
                      } else {
                        setOpen(false);
                        setDetail(n);
                      }
                    }}



                  >
                    <div className="flex gap-3">
                      <div className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isUrgent ? "bg-destructive/10 text-destructive" :
                        !n.is_read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        {isUrgent ? <AlertTriangle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight ${!n.is_read ? "font-semibold" : ""}`}>
                            {n.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); deleteItem(n); }}
                          >
                            <Trash2 className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: lang === "th" ? th : enUS,
                          })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t p-2 flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => { setOpen(false); setTimeout(() => navigate("/dashboard/inbox"), 0); }}
          >
            <InboxIcon className="w-3.5 h-3.5 mr-2" />
            {lang === "th" ? "ดูทั้งหมด" : "See all"}
          </Button>
          {(isAdmin || isDirector) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => { setOpen(false); setTimeout(() => navigate("/dashboard/admin/notifications"), 0); }}
              title={lang === "th" ? "แดชบอร์ดการส่งแจ้งเตือน" : "Delivery dashboard"}
            >
              📊
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => { setOpen(false); setTimeout(() => navigate("/dashboard/settings/notifications"), 0); }}
            title={lang === "th" ? "ตั้งค่าการแจ้งเตือน" : "Notification settings"}
          >
            ⚙️
          </Button>
        </div>

      </PopoverContent>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-6">{detail?.title}</DialogTitle>
            {detail && (
              <DialogDescription className="text-xs">
                {formatDistanceToNow(new Date(detail.created_at), {
                  addSuffix: true,
                  locale: lang === "th" ? th : enUS,
                })}
              </DialogDescription>
            )}
          </DialogHeader>
          {detail?.message && (
            <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-auto">
              {detail.message}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setDetail(null)}>
              {lang === "th" ? "ปิด" : "Close"}
            </Button>
            {detail && (() => {
              const r = routeForNotification(detail.raw, role);
              if (!r) return null;
              return (
                <Button
                  onClick={() => {
                    const target = r;
                    setDetail(null);
                    navigate(target);
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  {lang === "th" ? "ไปที่หน้าเนื้อหา" : "Open"}
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Popover>
  );
};


export default NotificationDropdown;
