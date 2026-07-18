import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Megaphone, Pin, PinOff, Search } from "lucide-react";
import { notify } from "@/lib/notify";

const CATEGORIES = [
  { value: "general", label: "ทั่วไป", labelEn: "General" },
  { value: "academic", label: "วิชาการ", labelEn: "Academic" },
  { value: "activity", label: "กิจกรรม", labelEn: "Activity" },
];

const AUDIENCES = [
  { value: "all", label: "ทุกคน", labelEn: "Everyone" },
  { value: "staff", label: "บุคลากร (ผู้ดูแล/ผอ./ครู)", labelEn: "Staff only" },
  { value: "students", label: "นักเรียน", labelEn: "Students" },
  { value: "parents", label: "ผู้ปกครอง", labelEn: "Parents" },
  { value: "alumni", label: "ศิษย์เก่า", labelEn: "Alumni" },
];

const AUDIENCE_TO_ROLES: Record<string, string[]> = {
  all: ["admin", "director", "teacher", "student", "parent", "alumni"],
  staff: ["admin", "director", "teacher"],
  students: ["student"],
  parents: ["parent"],
  alumni: ["alumni"],
};

const SEVERITIES = [
  { value: "info", label: "แจ้งเตือน", labelEn: "Info", color: "bg-info-soft text-info" },
  { value: "warning", label: "เตือนภัย", labelEn: "Warning", color: "bg-warning-soft text-warning" },
  { value: "critical", label: "วิกฤต", labelEn: "Critical", color: "bg-danger-soft text-danger" },
];

const NewsPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const { userId, isAdmin, isDirector } = useUserRole();
  const canManageAll = isAdmin || isDirector;
  const [tab, setTab] = useState("news");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // News state
  const [newsOpen, setNewsOpen] = useState(false);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsCategory, setNewsCategory] = useState("general");
  const [newsAudience, setNewsAudience] = useState("all");

  // Emergency state
  const [emerOpen, setEmerOpen] = useState(false);
  const [emerTitle, setEmerTitle] = useState("");
  const [emerMessage, setEmerMessage] = useState("");
  const [emerSeverity, setEmerSeverity] = useState("info");


  const { data: newsRecords = [] } = useQuery({
    queryKey: ["news_posts"],
    queryFn: async () => {
      const { data } = await supabase.from("news_posts").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: emerRecords = [] } = useQuery({
    queryKey: ["emergency_broadcasts"],
    queryFn: async () => {
      const { data } = await supabase.from("emergency_broadcasts").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleAddNews = async () => {
    if (!newsTitle || submitting) return;
    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase.from("news_posts").insert({
        title: newsTitle,
        content: newsContent,
        category: newsCategory,
        audience: newsAudience,
        author_id: userId,
      } as any).select("id").single();
      if (error) { toast.error(error.message); return; }
      toast.success(lang === "th" ? "เพิ่มข่าวสำเร็จ" : "News added");
      qc.invalidateQueries({ queryKey: ["news_posts"] });
      setNewsOpen(false); setNewsTitle(""); setNewsContent(""); setNewsCategory("general"); setNewsAudience("all");

      // Fan-out: notify all active users that a draft news was created (admin only get this)
      // Real broadcast happens when published.
      if (inserted?.id) {
        try {
          const { data: admins } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "director"]);
          const ids = [...new Set((admins ?? []).map((r: any) => r.user_id))].filter(Boolean);
          if (ids.length) {
            await notify({
              user_ids: ids,
              title: `📰 ข่าวใหม่ (ร่าง): ${newsTitle}`,
              body: newsContent?.slice(0, 120) || "",
              type: "news_draft",
              severity: "info",
              reference_id: inserted.id,
              reference_type: "news_posts",
              url: `/dashboard/news/${inserted.id}`,
              channels: ["in_app"],
              dedup_key: `news-draft-${inserted.id}`,
            });
          }
        } catch {/* non-blocking */}
      }
    } finally {
      setSubmitting(false);
    }
  };


  const handlePublish = async (id: string, pub: boolean) => {
    const willPublish = !pub;
    await supabase.from("news_posts").update({ is_published: willPublish, published_at: willPublish ? new Date().toISOString() : null } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["news_posts"] });
    // Notify everyone on publish
    if (willPublish) {
      try {
        const post = (newsRecords as any[]).find((r) => r.id === id);
        const aud = (post?.audience as string) || "all";
        const roles = AUDIENCE_TO_ROLES[aud] || AUDIENCE_TO_ROLES.all;
        const { data: targetUsers } = await supabase
          .from("user_roles").select("user_id").in("role", roles as any);
        const ids = [...new Set((targetUsers ?? []).map((r: any) => r.user_id))].filter(Boolean);
        if (post && ids.length) {
          await notify({
            user_ids: ids,
            title: `📰 ${post.title}`,
            body: (post.content || "").slice(0, 140),
            type: "news",
            severity: "info",
            reference_id: id,
            reference_type: "news_posts",
            url: `/dashboard/news/${id}`,
            gchat_categories: ["all"],
            channels: ["in_app", "push", "line", "gchat"],
            dedup_key: `news-publish-${id}`,
          });
        }
      } catch {/* non-blocking */}
    }
  };

  const togglePinNews = async (id: string, pinned: boolean) => {
    const { error } = await supabase.from("news_posts").update({ is_pinned: !pinned, pin_order: pinned ? null : 1 } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(!pinned ? (lang === "th" ? "ปักหมุดแล้ว" : "Pinned") : (lang === "th" ? "ยกเลิกปักหมุด" : "Unpinned"));
    qc.invalidateQueries({ queryKey: ["news_posts"] });
  };

  const setPinOrder = async (id: string, order: number | null) => {
    const { error } = await supabase.from("news_posts")
      .update({ pin_order: order, is_pinned: order != null } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(order ? `ปักหมุดเป็นอันดับ ${order}` : "ยกเลิกปักหมุด");
    qc.invalidateQueries({ queryKey: ["news_posts"] });
  };


  const togglePinEmer = async (id: string, pinned: boolean) => {
    const { error } = await supabase.from("emergency_broadcasts").update({ is_pinned: !pinned } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["emergency_broadcasts"] });
  };

  const handleDeleteNews = async (id: string) => {
    await supabase.from("news_posts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["news_posts"] });
  };

  const handleAddEmergency = async () => {
    if (!emerTitle || !emerMessage || submitting) return;
    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase.from("emergency_broadcasts").insert({
        title: emerTitle,
        message: emerMessage,
        severity: emerSeverity,
        author_id: userId,
      } as any).select("id").single();
      if (error) { toast.error(error.message); return; }
      toast.success(lang === "th" ? "ส่งประกาศสำเร็จ" : "Broadcast sent");
      qc.invalidateQueries({ queryKey: ["emergency_broadcasts"] });
      setEmerOpen(false); setEmerTitle(""); setEmerMessage(""); setEmerSeverity("info");

      // Fan-out emergency to everyone via all channels (critical bypasses quiet hours)
      try {
        const { data: allUsers } = await supabase.from("user_roles").select("user_id");
        const ids = [...new Set((allUsers ?? []).map((r: any) => r.user_id))].filter(Boolean);
        if (inserted?.id && ids.length) {
          const sev = (emerSeverity === "critical" ? "critical" : emerSeverity === "warning" ? "warning" : "info") as any;
          await notify({
            user_ids: ids,
            title: `🚨 ${emerTitle}`,
            body: emerMessage,
            type: "emergency",
            severity: sev,
            reference_id: inserted.id,
            reference_type: "emergency_broadcasts",
            url: `/dashboard`,
            gchat_categories: ["all"],
            channels: ["in_app", "push", "line", "gchat"],
            dedup_key: `emergency-${inserted.id}`,
          });
        }
      } catch {/* non-blocking */}
    } finally {
      setSubmitting(false);
    }
  };


  const handleDeleteEmergency = async (id: string) => {
    await supabase.from("emergency_broadcasts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["emergency_broadcasts"] });
  };

  // Filter + sort: pinned first, then by date desc
  const filteredNews = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (newsRecords as any[]).filter((r) =>
      !q || r.title?.toLowerCase().includes(q) || r.content?.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      const ao = a.pin_order ?? 99, bo = b.pin_order ?? 99;
      if (ao !== bo) return ao - bo;
      if (!!b.is_pinned !== !!a.is_pinned) return b.is_pinned ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [newsRecords, search]);

  const filteredEmer = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (emerRecords as any[]).filter((r) =>
      !q || r.title?.toLowerCase().includes(q) || r.message?.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      if (!!b.is_pinned !== !!a.is_pinned) return b.is_pinned ? 1 : -1;
      return new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime();
    });
  }, [emerRecords, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" />
          {lang === "th" ? "ข่าวสาร / ประกาศ" : "News & Announcements"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === "th"
            ? "บุคลากรทุกคนสร้างข่าว/ประกาศได้ และทุกคนเห็นข่าวรวมในหน้านี้"
            : "All staff can post news & alerts; everyone can view all posts here"}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={lang === "th" ? "ค้นหาข่าว/ประกาศ..." : "Search news/alerts..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="news" className="gap-1.5">
            <Megaphone className="w-4 h-4" />
            {lang === "th" ? "ข่าวสาร" : "News"} ({newsRecords.length})
          </TabsTrigger>
          <TabsTrigger value="emergency" className="gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {lang === "th" ? "ประกาศฉุกเฉิน" : "Emergency"} ({emerRecords.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── News Tab ─── */}
        <TabsContent value="news" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={newsOpen} onOpenChange={setNewsOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "เพิ่มข่าว" : "Add News"}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{lang === "th" ? "เพิ่มข่าวสาร" : "Add News"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>{lang === "th" ? "หัวข้อ" : "Title"}</Label><Input value={newsTitle} onChange={e => setNewsTitle(e.target.value)} /></div>
                  <div>
                    <Label>{lang === "th" ? "หมวดหมู่" : "Category"}</Label>
                    <Select value={newsCategory} onValueChange={setNewsCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{lang === "th" ? c.label : c.labelEn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{lang === "th" ? "กลุ่มผู้รับข่าว" : "Audience"}</Label>
                    <Select value={newsAudience} onValueChange={setNewsAudience}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AUDIENCES.map(a => (
                          <SelectItem key={a.value} value={a.value}>{lang === "th" ? a.label : a.labelEn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {lang === "th"
                        ? "เลือกว่าใครเห็นและได้รับแจ้งเตือนข่าวนี้"
                        : "Controls who can see and be notified about this news"}
                    </p>
                  </div>
                  <div><Label>{lang === "th" ? "เนื้อหา" : "Content"}</Label><Textarea value={newsContent} onChange={e => setNewsContent(e.target.value)} rows={4} /></div>
                  <Button onClick={handleAddNews} disabled={submitting} className="w-full">{submitting ? (lang === "th" ? "กำลังบันทึก..." : "Saving...") : (lang === "th" ? "บันทึก" : "Save")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{lang === "th" ? "หัวข้อ" : "Title"}</TableHead>
                <TableHead>{lang === "th" ? "หมวด" : "Category"}</TableHead>
                <TableHead>{lang === "th" ? "วันที่" : "Date"}</TableHead>
                <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                <TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {filteredNews.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{lang === "th" ? "ยังไม่มีข่าวสาร" : "No news yet"}</TableCell></TableRow>
                )}
                {filteredNews.map((r: any) => (
                  <TableRow key={r.id} className={r.is_pinned ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.pin_order && (
                          <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center">
                            {r.pin_order}
                          </span>
                        )}
                        {r.is_pinned && !r.pin_order && <Pin className="w-3.5 h-3.5 text-primary fill-primary" />}
                        {r.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORIES.find(c => c.value === r.category)?.[lang === "th" ? "label" : "labelEn"] || r.category}</Badge>
                      <Badge variant="secondary" className="ml-1">
                        {AUDIENCES.find(a => a.value === (r.audience || "all"))?.[lang === "th" ? "label" : "labelEn"] || r.audience}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(r.created_at).toLocaleDateString("th-TH")}</TableCell>
                    <TableCell>
                      <Badge
                        className={r.is_published ? "bg-success-soft text-success cursor-pointer" : "bg-muted text-muted-foreground cursor-pointer"}
                        onClick={() => handlePublish(r.id, r.is_published)}
                      >
                        {r.is_published ? (lang === "th" ? "เผยแพร่" : "Published") : (lang === "th" ? "ฉบับร่าง" : "Draft")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(canManageAll || r.author_id === userId) && (
                          <>
                            <select
                              value={r.pin_order ?? ""}
                              onChange={(e) => setPinOrder(r.id, e.target.value === "" ? null : Number(e.target.value))}
                              className="text-xs border rounded px-1 py-0.5 bg-background"
                              title="ปักหมุดอันดับ"
                            >
                              <option value="">— อันดับ —</option>
                              <option value="1">📌 อันดับ 1</option>
                              <option value="2">📌 อันดับ 2</option>
                              <option value="3">📌 อันดับ 3</option>
                            </select>
                            <Button variant="ghost" size="sm" title={r.is_pinned ? "ยกเลิกปักหมุด" : "ปักหมุด"} onClick={() => togglePinNews(r.id, r.is_pinned)}>
                              {r.is_pinned ? <PinOff className="w-4 h-4 text-primary" /> : <Pin className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteNews(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ─── Emergency Tab ─── */}
        <TabsContent value="emergency" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={emerOpen} onOpenChange={setEmerOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive"><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "ส่งประกาศฉุกเฉิน" : "Send Alert"}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{lang === "th" ? "ส่งประกาศฉุกเฉิน" : "Send Emergency Alert"}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>{lang === "th" ? "หัวข้อ" : "Title"}</Label><Input value={emerTitle} onChange={e => setEmerTitle(e.target.value)} /></div>
                  <div>
                    <Label>{lang === "th" ? "ระดับความรุนแรง" : "Severity"}</Label>
                    <Select value={emerSeverity} onValueChange={setEmerSeverity}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{lang === "th" ? s.label : s.labelEn}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>{lang === "th" ? "ข้อความ" : "Message"}</Label><Textarea value={emerMessage} onChange={e => setEmerMessage(e.target.value)} rows={4} /></div>
                  <Button variant="destructive" onClick={handleAddEmergency} disabled={submitting} className="w-full">{submitting ? (lang === "th" ? "กำลังส่ง..." : "Sending...") : (lang === "th" ? "ส่งประกาศ" : "Send")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{lang === "th" ? "เวลา" : "Time"}</TableHead>
                <TableHead>{lang === "th" ? "หัวข้อ" : "Title"}</TableHead>
                <TableHead>{lang === "th" ? "ข้อความ" : "Message"}</TableHead>
                <TableHead>{lang === "th" ? "ระดับ" : "Severity"}</TableHead>
                <TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {filteredEmer.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{lang === "th" ? "ยังไม่มีประกาศฉุกเฉิน" : "No alerts yet"}</TableCell></TableRow>
                )}
                {filteredEmer.map((r: any) => (
                  <TableRow key={r.id} className={r.is_pinned ? "bg-destructive/5" : ""}>
                    <TableCell className="whitespace-nowrap">{new Date(r.sent_at).toLocaleString("th-TH")}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.is_pinned && <Pin className="w-3.5 h-3.5 text-destructive fill-destructive" />}
                        {r.title}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.message}</TableCell>
                    <TableCell>
                      <Badge className={SEVERITIES.find(s => s.value === r.severity)?.color || ""}>
                        {SEVERITIES.find(s => s.value === r.severity)?.[lang === "th" ? "label" : "labelEn"] || r.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(canManageAll || r.author_id === userId) && (
                          <>
                            <Button variant="ghost" size="sm" title={r.is_pinned ? "ยกเลิกปักหมุด" : "ปักหมุด"} onClick={() => togglePinEmer(r.id, r.is_pinned)}>
                              {r.is_pinned ? <PinOff className="w-4 h-4 text-destructive" /> : <Pin className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteEmergency(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NewsPage;
