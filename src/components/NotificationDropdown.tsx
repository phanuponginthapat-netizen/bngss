import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Bell, CheckCheck, FileText, Megaphone, Info, Trash2,
  Mail, ClipboardCheck, AlertTriangle, Inbox as InboxIcon,
  Layers, List, ChevronDown, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { routeForNotification } from "@/lib/notificationRoute";
import { cn } from "@/lib/utils";

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

const TYPE_LABEL: Record<string, { th: string; en: string }> = {
  document: { th: "เอกสาร", en: "Docs" },
  announcement: { th: "ประกาศ", en: "News" },
  system: { th: "ระบบ", en: "System" },
  notification: { th: "แจ้งเตือน", en: "Alert" },
  approval: { th: "อนุมัติ", en: "Approval" },
  task: { th: "งาน", en: "Tasks" },
  eform: { th: "E-Form", en: "E-Form" },
};

const NotificationDropdown = () => {
  const { userId, isAdmin, isDirector, role } = useUserRole();
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [grouped, setGrouped] = useState<boolean>(() => {
    try { return localStorage.getItem("notif_grouped_v1") === "1"; } catch { return false; }
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (t: string) => setCollapsed((s) => ({ ...s, [t]: !s[t] }));
  const toggleGroupedMode = () => {
    setGrouped((v) => {
      try { localStorage.setItem("notif_grouped_v1", !v ? "1" : "0"); } catch { /* ignore */ }
      return !v;
    });
  };

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
    refetchInterval: 30000,
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
    refetchInterval: 30000,
  });

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

  // Type counts (for filter pills)
  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    merged.forEach((n) => { m[n.type] = (m[n.type] ?? 0) + (n.is_read ? 0 : 1); });
    return m;
  }, [merged]);

  const visible = useMemo(() => {
    let v = tab === "unread" ? merged.filter(i => !i.is_read) : merged;
    if (typeFilter) v = v.filter(i => i.type === typeFilter);
    return v;
  }, [merged, tab, typeFilter]);

  // Grouped buckets
  const buckets = useMemo(() => {
    const m = new Map<string, UnifiedItem[]>();
    visible.forEach((n) => {
      if (!m.has(n.type)) m.set(n.type, []);
      m.get(n.type)!.push(n);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [visible]);

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
    await Promise.all([
      (supabase.from("notifications") as any)
        .update({ is_read: true }).eq("user_id", userId).eq("is_read", false),
      (supabase.from("inbox_items") as any)
        .update({ is_read: true }).eq("user_id", userId).eq("is_read", false),
    ]);
    qc.invalidateQueries({ queryKey: ["my_notifications", userId] });
    qc.invalidateQueries({ queryKey: ["my_inbox_items", userId] });
  };

  const markGroupAsRead = async (items: UnifiedItem[]) => {
    const notifIds = items.filter(i => i.source === "notification" && !i.is_read).map(i => i.id);
    const inboxIds = items.filter(i => i.source === "inbox" && !i.is_read).map(i => i.id);
    await Promise.all([
      notifIds.length ? (supabase.from("notifications") as any).update({ is_read: true }).in("id", notifIds) : Promise.resolve(),
      inboxIds.length ? (supabase.from("inbox_items") as any).update({ is_read: true }).in("id", inboxIds) : Promise.resolve(),
    ]);
    qc.invalidateQueries({ queryKey: ["my_notifications", userId] });
    qc.invalidateQueries({ queryKey: ["my_inbox_items", userId] });
  };

  const deleteItem = async (item: UnifiedItem) => {
    await supabase.from(tableFor(item.source) as any).delete().eq("id", item.id);
    qc.invalidateQueries({ queryKey: ["my_notifications", userId] });
    qc.invalidateQueries({ queryKey: ["my_inbox_items", userId] });
  };

  const renderItem = (n: UnifiedItem) => {
    const Icon = typeIcons[n.type] || Info;
    const isUrgent = n.priority === "urgent";
    return (
      <div
        key={`${n.source}-${n.id}`}
        className={`px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group ${!n.is_read ? "bg-primary/5" : ""}`}
        onClick={() => {
          if (!n.is_read) markAsRead(n);
          const r = routeForNotification(n.raw, role) || "/dashboard/inbox";
          setOpen(false);
          navigate(r);
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
  };

  const availableTypes = Object.keys(typeCounts).filter(t => typeCounts[t] > 0);

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
      <PopoverContent align="end" className="w-[min(400px,calc(100vw-1rem))] p-0 flex flex-col max-h-[min(620px,calc(100vh-5rem))]">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 className="font-semibold text-sm">
            {lang === "th" ? "การแจ้งเตือน" : "Notifications"}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={toggleGroupedMode}
              title={lang === "th" ? "สลับมุมมอง" : "Toggle view"}
            >
              {grouped ? <List className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
                <CheckCheck className="w-3 h-3 mr-1" />
                {lang === "th" ? "อ่านทั้งหมด" : "Read all"}
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="px-3 pt-2 shrink-0">
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

        {/* Type filter pills */}
        {availableTypes.length > 1 && (
          <div className="px-3 pt-2 pb-1 flex gap-1 flex-wrap shrink-0">
            <button
              onClick={() => setTypeFilter(null)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                !typeFilter ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
              )}
            >
              {lang === "th" ? "ทุกชนิด" : "All types"}
            </button>
            {availableTypes.map((t) => {
              const Icon = typeIcons[t] || Info;
              const label = TYPE_LABEL[t] ? (lang === "th" ? TYPE_LABEL[t].th : TYPE_LABEL[t].en) : t;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1",
                    typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  )}
                >
                  <Icon className="w-2.5 h-2.5" />
                  {label}
                  {typeCounts[t] > 0 && (
                    <span className={cn(
                      "ml-0.5 rounded-full px-1 text-[9px] font-bold",
                      typeFilter === t ? "bg-primary-foreground/20" : "bg-destructive/10 text-destructive"
                    )}>{typeCounts[t]}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0 overscroll-contain [&>[data-radix-scroll-area-viewport]]:max-h-[420px]">
          {visible.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {lang === "th" ? "ไม่มีการแจ้งเตือน" : "No notifications"}
              </p>
            </div>
          ) : grouped ? (
            <div className="divide-y">
              {buckets.map(([type, items]) => {
                const isCollapsed = collapsed[type];
                const Icon = typeIcons[type] || Info;
                const label = TYPE_LABEL[type] ? (lang === "th" ? TYPE_LABEL[type].th : TYPE_LABEL[type].en) : type;
                const unread = items.filter(i => !i.is_read).length;
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 sticky top-0 z-[1] backdrop-blur">
                      <button
                        onClick={() => toggleGroup(type)}
                        className="flex items-center gap-1.5 flex-1 text-left hover:text-foreground text-muted-foreground"
                      >
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">{label}</span>
                        <span className="text-[10px] text-muted-foreground">({items.length})</span>
                        {unread > 0 && (
                          <span className="text-[10px] text-destructive font-bold">• {unread} {lang === "th" ? "ใหม่" : "new"}</span>
                        )}
                      </button>
                      {unread > 0 && (
                        <button
                          onClick={() => markGroupAsRead(items)}
                          className="text-[10px] text-primary hover:underline shrink-0"
                        >
                          {lang === "th" ? "อ่านกลุ่มนี้" : "Mark group"}
                        </button>
                      )}
                    </div>
                    {!isCollapsed && <div className="divide-y">{items.map(renderItem)}</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y">{visible.map(renderItem)}</div>
          )}
        </ScrollArea>

        <div className="border-t p-2 flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => { setOpen(false); navigate("/dashboard/inbox"); }}
          >
            <InboxIcon className="w-3.5 h-3.5 mr-2" />
            {lang === "th" ? "ดูทั้งหมด" : "See all"}
          </Button>
          {(isAdmin || isDirector) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => { setOpen(false); navigate("/dashboard/admin/notifications"); }}
              title={lang === "th" ? "แดชบอร์ดการส่งแจ้งเตือน" : "Delivery dashboard"}
            >
              📊
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => { setOpen(false); navigate("/dashboard/settings/notifications"); }}
            title={lang === "th" ? "ตั้งค่าการแจ้งเตือน" : "Notification settings"}
          >
            ⚙️
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationDropdown;
