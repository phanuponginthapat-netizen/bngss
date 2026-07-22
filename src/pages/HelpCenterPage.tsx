import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen, Search, GraduationCap, Users, ShieldCheck,
  Sparkles, MessageSquare, Camera, CalendarDays, Wallet, Bell,
} from "lucide-react";

type Article = {
  q: string;
  a: string;
  tags: string[];
  audience: ("teacher" | "admin" | "parent" | "student")[];
};

const ARTICLES: Article[] = [
  {
    q: "ลืมรหัสผ่านต้องทำอย่างไร?",
    a: "หน้าเข้าสู่ระบบ กด 'ลืมรหัสผ่าน' แล้วกรอกอีเมล ระบบจะส่งลิงก์รีเซ็ตให้ทางอีเมล ถ้าไม่พบใน Inbox ให้ตรวจใน Junk/Spam ด้วย",
    tags: ["บัญชี", "รหัสผ่าน"],
    audience: ["teacher", "admin", "parent", "student"],
  },
  {
    q: "เช็คชื่อนักเรียนได้อย่างไร?",
    a: "เมนู 'การเข้าเรียน' → เลือกห้อง → เลือกวัน → กดเช็คแต่ละคน หรือใช้ Face Scan Kiosk ให้นักเรียนสแกนหน้าตอนเข้าโรงเรียน ระบบจะบันทึกอัตโนมัติ",
    tags: ["เช็คชื่อ", "การเข้าเรียน"],
    audience: ["teacher", "admin"],
  },
  {
    q: "บันทึกคะแนนแล้วแก้ไขได้ไหม?",
    a: "แก้ได้ก่อนปิดภาคเรียน เมนู 'คะแนน' → เลือกวิชา → คลิกช่องคะแนน แก้แล้วกด Enter ระบบบันทึกอัตโนมัติ และเก็บประวัติการแก้ไขไว้ใน Audit Log",
    tags: ["คะแนน", "เกรด"],
    audience: ["teacher", "admin"],
  },
  {
    q: "แจ้งเตือน (Notification) ไม่มา ทำอย่างไร?",
    a: "1) ตรวจว่าเปิด Notification ใน browser แล้ว 2) ติดตั้งเป็น PWA (Add to Home Screen) จะได้ push จริง 3) เข้า 'ตั้งค่าการแจ้งเตือน' เพื่อเลือกช่องทางที่ต้องการรับ",
    tags: ["แจ้งเตือน", "PWA"],
    audience: ["teacher", "admin", "parent", "student"],
  },
  {
    q: "อัปโหลดรูปโปรไฟล์แล้วไม่แสดง?",
    a: "รูปโปรไฟล์เก็บไว้ใน bucket ปิดเพื่อความปลอดภัย ระบบสร้าง signed URL ให้อัตโนมัติ ถ้ายังไม่แสดง ลอง refresh หน้า (Ctrl+F5) หรือ logout/login ใหม่",
    tags: ["โปรไฟล์", "รูป"],
    audience: ["teacher", "admin", "parent", "student"],
  },
  {
    q: "นำเข้าข้อมูลนักเรียนจาก DMC ทำอย่างไร?",
    a: "เมนู Admin → 'DMC Import' → เลือกไฟล์ Excel จาก DMC → ระบบจะ match column อัตโนมัติ → กด Import ระบบจะประมวลผลด้วย worker pool (10-15x เร็วกว่าเดิม)",
    tags: ["นำเข้าข้อมูล", "DMC"],
    audience: ["admin"],
  },
  {
    q: "AI ไม่ตอบ / ค้าง / error ทำอย่างไร?",
    a: "1) เช็ค System Health ว่า AI Key Pool ยัง active หรือไม่ 2) ถ้าเป็น 429 = rate limit จะสลับ key อัตโนมัติ 3) ถ้าทุก key cooldown ให้เพิ่ม key ใหม่ที่ 'AI Key Pool'",
    tags: ["AI", "ปัญหา"],
    audience: ["admin"],
  },
  {
    q: "ต่อ Google Drive แล้วอัปโหลดไฟล์ไม่ได้?",
    a: "1) เข้า 'My Drive' → กด 'ต่อ Google Drive' 2) อนุญาต scope ที่ระบบขอ 3) ถ้าขึ้น 'credential not found' ให้กด 'reconnect' อีกครั้ง",
    tags: ["Google Drive", "OAuth"],
    audience: ["teacher", "admin"],
  },
  {
    q: "Kiosk เปิดแล้วเด้งออกเอง?",
    a: "ระบบมี auto-respawn ให้ ถ้ายังเด้ง ให้ตรวจ /var/log/kiosk.log และตรวจ URL ใน /opt/kiosk-setup.sh ต้องเป็น https://bngss.lovable.app/kiosk (ไม่ใช่ preview URL)",
    tags: ["Kiosk", "Linux"],
    audience: ["admin"],
  },
  {
    q: "ครูดูรายงานการสแกนเข้าโรงเรียนไม่ได้?",
    a: "ครูมีสิทธิ์ดูรายชื่อนักเรียนทั้งโรงเรียนสำหรับรายงานภาพรวมแล้ว ถ้ายังไม่เห็น กด logout/login ใหม่เพื่อรีเฟรช session",
    tags: ["รายงาน", "สิทธิ์"],
    audience: ["teacher"],
  },
  {
    q: "แปะโน๊ต (Padlet) แล้วไม่ขึ้นชื่อ / real-time?",
    a: "ระบบเปิด realtime ให้แล้ว ถ้าไม่ขึ้น = network firewall block WebSocket ให้ลองเปลี่ยนเครือข่าย หรือใช้ 4G/5G",
    tags: ["Padlet", "Realtime"],
    audience: ["teacher"],
  },
  {
    q: "งบประมาณ / รายรับรายจ่าย ดูย้อนหลังได้ไหม?",
    a: "ทุกการเปลี่ยนแปลงตัวเงินถูกบันทึกใน Audit Log อัตโนมัติ เข้า Admin → Audit Log → เลือกตาราง 'budget_transactions' จะเห็นทุกการเคลื่อนไหว",
    tags: ["งบประมาณ", "Audit"],
    audience: ["admin"],
  },
];

const CATEGORIES = [
  { label: "ทั้งหมด", value: "all", icon: BookOpen },
  { label: "บัญชี", value: "บัญชี", icon: ShieldCheck },
  { label: "การเข้าเรียน", value: "การเข้าเรียน", icon: CalendarDays },
  { label: "คะแนน", value: "คะแนน", icon: GraduationCap },
  { label: "แจ้งเตือน", value: "แจ้งเตือน", icon: Bell },
  { label: "AI", value: "AI", icon: Sparkles },
  { label: "Kiosk", value: "Kiosk", icon: Camera },
  { label: "งบประมาณ", value: "งบประมาณ", icon: Wallet },
  { label: "อื่นๆ", value: "อื่นๆ", icon: MessageSquare },
];

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTICLES.filter((a) => {
      const matchQ =
        !q ||
        a.q.toLowerCase().includes(q) ||
        a.a.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q));
      const matchC =
        category === "all" ||
        a.tags.some((t) => t.toLowerCase().includes(category.toLowerCase()));
      return matchQ && matchC;
    });
  }, [query, category]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <BookOpen className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">ศูนย์ช่วยเหลือ</h1>
          <p className="text-sm text-muted-foreground">
            คำถามที่พบบ่อย + วิธีใช้งานระบบ
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ค้นหาคำถาม เช่น 'ลืมรหัสผ่าน', 'เช็คชื่อ', 'AI'..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {CATEGORIES.map((c) => (
              <Badge
                key={c.value}
                variant={category === c.value ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setCategory(c.value)}
              >
                <c.icon className="w-3 h-3 mr-1" />
                {c.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            พบ {filtered.length} คำถาม
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              ไม่พบคำถามที่ตรงกับการค้นหา — ลองคำอื่นหรือกด 'ทั้งหมด'
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {filtered.map((a, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left">
                    {a.q}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {a.a}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {a.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                      {a.audience.map((r) => (
                        <Badge key={r} variant="outline" className="text-xs">
                          {r === "teacher" && "ครู"}
                          {r === "admin" && "ผู้ดูแล"}
                          {r === "parent" && "ผู้ปกครอง"}
                          {r === "student" && "นักเรียน"}
                        </Badge>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 text-sm space-y-1">
          <div className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> ยังไม่พบคำตอบ?
          </div>
          <p className="text-muted-foreground">
            ติดต่อผู้ดูแลระบบของโรงเรียน หรือแจ้งปัญหาที่เมนู 'แจ้งปัญหา / ข้อเสนอแนะ'
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
