import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Webhook, Send, MessageSquare, Settings, Edit, BarChart3 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const DEPARTMENTS = [
  { value: "academic", th: "ฝ่ายวิชาการ", en: "Academic" },
  { value: "student_affairs", th: "ฝ่ายกิจการนักเรียน", en: "Student Affairs" },
  { value: "general_admin", th: "ฝ่ายบริหารทั่วไป", en: "General Admin" },
  { value: "hr", th: "ฝ่ายงบประมาณและบุคคล", en: "HR & Budget" },
  { value: "director", th: "ผู้อำนวยการ", en: "Director" },
  { value: "connexted", th: "ฝ่ายงาน ConnextED", en: "ConnextED" },
  { value: "all", th: "ทุกฝ่าย (รวม)", en: "All Departments" },
];

const NOTIFICATION_TYPES = [
  { value: "staff_leave", th: "ครูยื่นลา", en: "Staff Leave", icon: "🏖️" },
  { value: "staff_leave_approved", th: "อนุมัติลาแล้ว", en: "Leave Approved", icon: "✅" },
  { value: "student_leave", th: "นักเรียนยื่นลา", en: "Student Leave", icon: "📝" },
  { value: "substitute", th: "มอบหมายสอนแทน", en: "Substitute Teaching", icon: "🔄" },
  { value: "document", th: "หนังสือ/สารบรรณใหม่", en: "Documents", icon: "📄" },
  { value: "eform", th: "E-Form (ส่ง/ลงนาม/ปฏิเสธ)", en: "E-Form", icon: "📨" },
  { value: "emergency", th: "ประกาศฉุกเฉิน", en: "Emergency", icon: "🚨" },
  { value: "news", th: "ข่าวประกาศ", en: "News", icon: "📢" },
  { value: "behavior", th: "พฤติกรรมร้ายแรง", en: "Serious Behavior", icon: "⚠️" },
  { value: "attendance", th: "การเช็คชื่อ/ขาดเรียน", en: "Attendance", icon: "✅" },
  { value: "face_scan", th: "สแกนหน้าเข้า-ออก", en: "Face Scan", icon: "📷" },
  { value: "ict_loan", th: "ยืม-คืน ICT", en: "ICT Loans", icon: "💻" },
  { value: "asset_damage", th: "แจ้งซ่อม/พัสดุชำรุด", en: "Asset Damage", icon: "🛠️" },
  { value: "garbage", th: "ธนาคารขยะ/Badge", en: "Garbage Bank", icon: "♻️" },
  { value: "enrollment", th: "การลงทะเบียน", en: "Enrollment", icon: "📝" },
  { value: "assessment", th: "ผลประเมิน", en: "Assessment", icon: "📊" },
  { value: "grades", th: "เกรด/คะแนน", en: "Grades", icon: "🎓" },
  { value: "score", th: "บันทึกคะแนน", en: "Score Entry", icon: "📊" },
  { value: "summary", th: "รายงานสรุป (วัน/เดือน/ภาค)", en: "Summary Reports", icon: "📈" },
  { value: "system", th: "ระบบ/ทดสอบ", en: "System", icon: "⚙️" },
];

const ALL_TYPES = NOTIFICATION_TYPES.map(t => t.value);

const WebhookManagementPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [department, setDepartment] = useState("hr");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookName, setWebhookName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([...ALL_TYPES]);

  // Edit message templates
  const [editWebhook, setEditWebhook] = useState<any>(null);
  const [editTypes, setEditTypes] = useState<string[]>([]);
  const [editMessages, setEditMessages] = useState<Record<string, string>>({});

  const { data: webhooks = [] } = useQuery({
    queryKey: ["google_chat_webhooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("google_chat_webhooks_meta" as any)
        .select("id,department,webhook_name,is_active,notification_types,custom_messages,created_at,has_url")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const toggleType = (type: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(type) ? list.filter(t => t !== type) : [...list, type]);
  };

  const handleAdd = async () => {
    if (!webhookUrl || !department) {
      toast.error(lang === "th" ? "กรุณากรอกข้อมูลให้ครบ" : "Please fill all fields");
      return;
    }
    const { error } = await supabase.from("google_chat_webhooks" as any).insert({
      department,
      webhook_url: webhookUrl,
      webhook_name: webhookName || department,
      notification_types: selectedTypes,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "เพิ่ม Webhook สำเร็จ" : "Webhook added");
    qc.invalidateQueries({ queryKey: ["google_chat_webhooks"] });
    setOpen(false);
    setWebhookUrl(""); setWebhookName(""); setSelectedTypes([...ALL_TYPES]);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from("google_chat_webhooks" as any).update({ is_active: !isActive } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["google_chat_webhooks"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("google_chat_webhooks" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["google_chat_webhooks"] });
    toast.success(lang === "th" ? "ลบสำเร็จ" : "Deleted");
  };

  const handleTest = async (webhook: any) => {
    try {
      await supabase.functions.invoke("notify-google-chat", {
        body: {
          message: `🧪 *ทดสอบการเชื่อมต่อ*\nWebhook: ${webhook.webhook_name || webhook.department}\nฝ่าย: ${getDeptLabel(webhook.department)}\n✅ การเชื่อมต่อสำเร็จ!`,
          department: webhook.department,
          notification_type: "system",
        },
      });
      toast.success(lang === "th" ? "ส่งข้อความทดสอบแล้ว" : "Test message sent");
    } catch (err) {
      toast.error(lang === "th" ? "ส่งไม่สำเร็จ" : "Failed to send");
    }
  };

  const openEditDialog = (webhook: any) => {
    setEditWebhook(webhook);
    setEditTypes(webhook.notification_types || [...ALL_TYPES]);
    setEditMessages(webhook.custom_messages || {});
  };

  const handleSaveEdit = async () => {
    if (!editWebhook) return;
    const { error } = await supabase.from("google_chat_webhooks" as any)
      .update({ notification_types: editTypes, custom_messages: editMessages } as any)
      .eq("id", editWebhook.id);
    if (error) { toast.error(error.message); return; }
    toast.success(lang === "th" ? "บันทึกสำเร็จ" : "Saved");
    qc.invalidateQueries({ queryKey: ["google_chat_webhooks"] });
    setEditWebhook(null);
  };

  const getDeptLabel = (dept: string) => {
    const d = DEPARTMENTS.find(d => d.value === dept);
    return d ? (lang === "th" ? d.th : d.en) : dept;
  };

  const getTypeLabel = (type: string) => {
    const t = NOTIFICATION_TYPES.find(n => n.value === type);
    return t ? (lang === "th" ? `${t.icon} ${t.th}` : `${t.icon} ${t.en}`) : type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            {lang === "th" ? "จัดการ Google Chat Webhook" : "Google Chat Webhooks"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "th" ? "ตั้งค่า Webhook สำหรับแจ้งเตือนแต่ละฝ่าย และกำหนดประเภทข้อความที่จะส่ง" : "Configure webhooks and message types per department"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2"><BarChart3 className="w-4 h-4" />{lang === "th" ? "ส่งรายงานสรุปทันที" : "Send Summary Now"}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(["daily","monthly","term"] as const).map(p => (
                  <DropdownMenuItem key={p} onClick={async () => {
                    try {
                      await supabase.functions.invoke("gchat-summary", { body: { period: p } });
                      toast.success(lang === "th" ? "ส่งรายงานสรุปแล้ว" : "Summary sent");
                    } catch { toast.error(lang === "th" ? "ส่งไม่สำเร็จ" : "Failed"); }
                  }}>
                    {p === "daily" ? (lang === "th" ? "📅 ประจำวัน" : "📅 Daily")
                     : p === "monthly" ? (lang === "th" ? "📊 ประจำเดือน" : "📊 Monthly")
                     : (lang === "th" ? "📈 ประจำภาคเรียน" : "📈 Term")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />{lang === "th" ? "เพิ่ม Webhook" : "Add Webhook"}</Button>
            </DialogTrigger>
          </div>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{lang === "th" ? "เพิ่ม Google Chat Webhook" : "Add Google Chat Webhook"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{lang === "th" ? "ชื่อ Webhook" : "Webhook Name"}</Label>
                <Input className="mt-1" value={webhookName} onChange={e => setWebhookName(e.target.value)} placeholder={lang === "th" ? "เช่น แจ้งเตือนฝ่ายบุคคล" : "e.g. HR Notifications"} />
              </div>
              <div>
                <Label>{lang === "th" ? "ฝ่ายงาน" : "Department"}</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{lang === "th" ? d.th : d.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Webhook URL *</Label>
                <Input className="mt-1" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://chat.googleapis.com/v1/spaces/..." />
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "th" ? "คัดลอก URL จาก Google Chat > Manage webhooks" : "Copy URL from Google Chat > Manage webhooks"}
                </p>
              </div>

              {/* Notification types selection */}
              <div className="space-y-2 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{lang === "th" ? "ประเภทการแจ้งเตือนที่รับ" : "Notification Types"}</Label>
                  <Button type="button" variant="ghost" size="sm" className="text-xs h-6"
                    onClick={() => setSelectedTypes(selectedTypes.length === ALL_TYPES.length ? [] : [...ALL_TYPES])}>
                    {selectedTypes.length === ALL_TYPES.length ? (lang === "th" ? "ยกเลิกทั้งหมด" : "Deselect All") : (lang === "th" ? "เลือกทั้งหมด" : "Select All")}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {NOTIFICATION_TYPES.map(nt => (
                    <label key={nt.value} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox checked={selectedTypes.includes(nt.value)} onCheckedChange={() => toggleType(nt.value, selectedTypes, setSelectedTypes)} />
                      <span>{nt.icon} {lang === "th" ? nt.th : nt.en}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
              <Button onClick={handleAdd}>{lang === "th" ? "บันทึก" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Webhook className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              <p className="font-medium mb-1">{lang === "th" ? "วิธีสร้าง Webhook URL" : "How to create a Webhook URL"}</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>{lang === "th" ? "เปิด Google Chat ในห้องที่ต้องการ" : "Open the target Google Chat room"}</li>
                <li>{lang === "th" ? 'คลิก "จัดการ Webhook" หรือ "Manage webhooks"' : 'Click "Manage webhooks"'}</li>
                <li>{lang === "th" ? "สร้าง Webhook ใหม่ แล้วคัดลอก URL" : "Create new webhook and copy the URL"}</li>
                <li>{lang === "th" ? "วาง URL ในช่องด้านบน" : "Paste the URL above"}</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{lang === "th" ? "รายการ Webhook" : "Webhook List"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "th" ? "ชื่อ" : "Name"}</TableHead>
                <TableHead>{lang === "th" ? "ฝ่าย" : "Department"}</TableHead>
                <TableHead>{lang === "th" ? "ประเภทแจ้งเตือน" : "Notification Types"}</TableHead>
                <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                <TableHead>{lang === "th" ? "จัดการ" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((w: any) => {
                const types = w.notification_types || ALL_TYPES;
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{w.webhook_name || "-"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {w.has_url ? (lang === "th" ? "🔒 URL ถูกซ่อน (เก็บใน server)" : "🔒 URL hidden (server-only)") : (lang === "th" ? "⚠️ ยังไม่ตั้งค่า URL" : "⚠️ URL not set")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getDeptLabel(w.department)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {types.length === ALL_TYPES.length ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {lang === "th" ? "ทุกประเภท" : "All types"}
                          </Badge>
                        ) : types.length === 0 ? (
                          <span className="text-xs text-muted-foreground">{lang === "th" ? "ไม่มี" : "None"}</span>
                        ) : (
                          types.slice(0, 3).map((t: string) => {
                            const nt = NOTIFICATION_TYPES.find(n => n.value === t);
                            return (
                              <Badge key={t} variant="secondary" className="text-[10px]">
                                {nt?.icon} {lang === "th" ? nt?.th : nt?.en}
                              </Badge>
                            );
                          })
                        )}
                        {types.length > 3 && types.length < ALL_TYPES.length && (
                          <Badge variant="outline" className="text-[10px]">+{types.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch checked={w.is_active} onCheckedChange={() => handleToggle(w.id, w.is_active)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(w)} title={lang === "th" ? "ตั้งค่า" : "Settings"}>
                          <Settings className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleTest(w)} title="Test">
                          <Send className="w-4 h-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(w.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {webhooks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {lang === "th" ? "ยังไม่มี Webhook" : "No webhooks configured"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog for notification types & custom messages */}
      <Dialog open={!!editWebhook} onOpenChange={(v) => { if (!v) setEditWebhook(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              {lang === "th" ? "ตั้งค่า Webhook" : "Webhook Settings"}: {editWebhook?.webhook_name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="types" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="types" className="flex-1">{lang === "th" ? "ประเภทแจ้งเตือน" : "Types"}</TabsTrigger>
              <TabsTrigger value="messages" className="flex-1">{lang === "th" ? "ข้อความกำหนดเอง" : "Custom Messages"}</TabsTrigger>
            </TabsList>

            <TabsContent value="types" className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {lang === "th" ? "เลือกประเภทการแจ้งเตือนที่ Webhook นี้จะรับ" : "Select notification types this webhook receives"}
                </p>
                <Button type="button" variant="ghost" size="sm" className="text-xs h-6"
                  onClick={() => setEditTypes(editTypes.length === ALL_TYPES.length ? [] : [...ALL_TYPES])}>
                  {editTypes.length === ALL_TYPES.length ? (lang === "th" ? "ยกเลิกทั้งหมด" : "Deselect All") : (lang === "th" ? "เลือกทั้งหมด" : "Select All")}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {NOTIFICATION_TYPES.map(nt => (
                  <label key={nt.value} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                    <Checkbox checked={editTypes.includes(nt.value)} onCheckedChange={() => toggleType(nt.value, editTypes, setEditTypes)} />
                    <span className="text-sm">{nt.icon} {lang === "th" ? nt.th : nt.en}</span>
                  </label>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="messages" className="space-y-3 mt-4">
              <p className="text-sm text-muted-foreground">
                {lang === "th" ? "กำหนดข้อความเพิ่มเติมที่จะแนบไปกับแต่ละประเภทการแจ้งเตือน (ถ้าไม่กรอกจะใช้ข้อความเริ่มต้น)" : "Set custom prefix messages per notification type (optional)"}
              </p>
              <div className="space-y-3">
                {NOTIFICATION_TYPES.filter(nt => editTypes.includes(nt.value)).map(nt => (
                  <div key={nt.value}>
                    <Label className="text-xs flex items-center gap-1 mb-1">
                      {nt.icon} {lang === "th" ? nt.th : nt.en}
                    </Label>
                    <Textarea
                      value={editMessages[nt.value] || ""}
                      onChange={e => setEditMessages(prev => ({ ...prev, [nt.value]: e.target.value }))}
                      placeholder={lang === "th" ? "ข้อความเพิ่มเติม (ไม่บังคับ)..." : "Custom prefix message (optional)..."}
                      className="min-h-[50px] text-sm"
                    />
                  </div>
                ))}
                {editTypes.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    {lang === "th" ? "กรุณาเลือกประเภทแจ้งเตือนก่อน" : "Select notification types first"}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWebhook(null)}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
            <Button onClick={handleSaveEdit}>{lang === "th" ? "บันทึก" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebhookManagementPage;
