import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  GraduationCap, Users, Recycle, Cpu, DollarSign, Package, Calendar,
  FileText, ClipboardList, Shield, Megaphone, Heart, BookOpen,
  Activity, Network, IdCard, Globe, Search, Activity as ActivityIcon, Zap,
} from "lucide-react";
import { useSpiderHubMetrics } from "@/hooks/useSpiderHubMetrics";
import { cn } from "@/lib/utils";

type AppRole = "admin" | "director" | "teacher" | "student" | "alumni";

interface ModuleNode {
  id: string;
  label: string;
  description: string;
  icon: typeof GraduationCap;
  color: string;            // tailwind text color
  bg: string;               // tailwind bg gradient
  url: string;
  roles?: AppRole[];
  related: string[];        // ids of related modules
  category: "core" | "academic" | "student" | "hr" | "finance" | "iot" | "comms";
}

const MODULES: ModuleNode[] = [
  // Core
  { id: "profile", label: "โปรไฟล์", description: "ข้อมูลส่วนตัว / บัตรประจำตัว", icon: Users, color: "text-info", bg: "from-info/20 to-info/10", url: "/dashboard/profile", related: ["users", "id-cards", "personnel"], category: "core" },
  { id: "users", label: "ผู้ใช้งาน", description: "จัดการผู้ใช้ & สิทธิ์", icon: Shield, color: "text-info", bg: "from-info/20 to-info/10", url: "/dashboard/users", roles: ["admin", "director"], related: ["profile", "personnel"], category: "core" },
  { id: "cms", label: "เว็บไซต์ (CMS)", description: "หน้าหลักประชาสัมพันธ์", icon: Globe, color: "text-info", bg: "from-info/20 to-info/10", url: "/dashboard/admin/cms", roles: ["admin"], related: ["news"], category: "comms" },

  // Academic
  { id: "academic", label: "วิชาการ", description: "หลักสูตร / รายวิชา / ตารางสอน", icon: BookOpen, color: "text-info", bg: "from-info/20 to-info/10", url: "/dashboard/academic/management", related: ["schedule", "students", "pp5", "attendance"], category: "academic" },
  { id: "schedule", label: "ตารางเรียน", description: "ตารางสอน / คาบเรียน", icon: Calendar, color: "text-warning", bg: "from-warning/20 to-warning/10", url: "/dashboard/academic/schedule", related: ["academic", "attendance", "substitute"], category: "academic" },
  { id: "students", label: "นักเรียน (DMC)", description: "ทะเบียน 29 ฟิลด์ มาตรฐาน DMC", icon: GraduationCap, color: "text-info", bg: "from-info/20 to-info/10", url: "/dashboard/academic/all-students", related: ["academic", "attendance", "behavior", "health", "pp5"], category: "academic" },
  { id: "pp5", label: "ปพ.5 / เกรด", description: "บันทึกผลการเรียน", icon: ClipboardList, color: "text-danger", bg: "from-danger/20 to-danger/10", url: "/dashboard/academic/pp5", related: ["students", "academic", "transcript"], category: "academic" },
  { id: "transcript", label: "ปพ.1", description: "ระเบียนแสดงผล", icon: FileText, color: "text-success", bg: "from-success/20 to-success/10", url: "/dashboard/academic/transcript", related: ["pp5", "students"], category: "academic" },
  { id: "calendar", label: "ปฏิทิน", description: "กิจกรรมโรงเรียน", icon: Calendar, color: "text-success", bg: "from-success/20 to-success/10", url: "/dashboard/academic/calendar", related: ["news", "schedule"], category: "academic" },

  // Student affairs
  { id: "attendance", label: "เช็กชื่อ", description: "หน้าเสาธง + รายคาบ + QR", icon: ClipboardList, color: "text-success", bg: "from-success/20 to-success/10", url: "/dashboard/student/attendance", related: ["students", "schedule", "leave", "behavior"], category: "student" },
  { id: "behavior", label: "พฤติกรรม", description: "บันทึกพฤติกรรม + คะแนน", icon: Shield, color: "text-danger", bg: "from-danger/20 to-danger/10", url: "/dashboard/student/behavior", related: ["students", "attendance", "homeroom"], category: "student" },
  { id: "leave", label: "การลา", description: "ลานักเรียน / ขออนุมัติ", icon: FileText, color: "text-warning", bg: "from-warning/20 to-warning/10", url: "/dashboard/student/leave", related: ["attendance", "students"], category: "student" },
  { id: "homeroom", label: "โฮมรูม", description: "บันทึกโฮมรูม", icon: Users, color: "text-info", bg: "from-info/20 to-info/10", url: "/dashboard/student/homeroom", related: ["attendance", "behavior", "students"], category: "student" },
  { id: "health", label: "วัคซีน / สุขภาพ", description: "บันทึกสุขภาพนักเรียน", icon: Heart, color: "text-danger", bg: "from-danger/20 to-danger/10", url: "/dashboard/admin/vaccine", related: ["students"], category: "student" },

  // Garbage
  { id: "garbage", label: "ธนาคารขยะ", description: "ฝาก/แลก/แต้ม/รางวัล", icon: Recycle, color: "text-success", bg: "from-success/20 to-success/10", url: "/dashboard/garbage", related: ["students", "personnel"], category: "student" },

  // IoT
  { id: "iot", label: "IoT / สมาร์ทดีไวซ์", description: "Home Assistant / REST API", icon: Cpu, color: "text-info", bg: "from-info/20 to-success/10", url: "/dashboard/iot", related: ["assets"], category: "iot" },

  // HR
  { id: "personnel", label: "บุคลากร (P-OBEC)", description: "ทะเบียนบุคลากร", icon: Users, color: "text-info", bg: "from-info/20 to-danger/10", url: "/dashboard/hr/personnel", roles: ["admin", "director"], related: ["users", "salary", "evaluation", "substitute"], category: "hr" },
  { id: "evaluation", label: "DPA / วิทยฐานะ", description: "ประเมินผลงาน 360°", icon: Activity, color: "text-warning", bg: "from-warning/20 to-warning/10", url: "/dashboard/hr/evaluation", related: ["personnel"], category: "hr" },
  { id: "salary", label: "เงินเดือน", description: "เงินเดือน / สลิป", icon: DollarSign, color: "text-success", bg: "from-success/20 to-success/10", url: "/dashboard/hr/salary", roles: ["admin", "director"], related: ["personnel", "budget"], category: "hr" },
  { id: "substitute", label: "สอนแทน", description: "จัดสอนแทนอัตโนมัติ", icon: Users, color: "text-info", bg: "from-info/20 to-info/10", url: "/dashboard/hr/substitute", related: ["schedule", "personnel"], category: "hr" },

  // Finance
  { id: "budget", label: "งบประมาณ", description: "งบ & บัญชี", icon: DollarSign, color: "text-success", bg: "from-success/20 to-success/10", url: "/dashboard/finance/budget", roles: ["admin", "director"], related: ["procurement", "salary", "assets"], category: "finance" },
  { id: "procurement", label: "จัดซื้อ", description: "e-GP / PO", icon: Package, color: "text-warning", bg: "from-warning/20 to-warning/10", url: "/dashboard/finance/procurement", roles: ["admin", "director"], related: ["budget", "assets"], category: "finance" },
  { id: "assets", label: "ทรัพย์สิน", description: "พัสดุ / แจ้งซ่อม", icon: Package, color: "text-warning", bg: "from-warning/20 to-danger/10", url: "/dashboard/finance/assets", roles: ["admin", "director"], related: ["procurement", "iot"], category: "finance" },

  // Comms
  { id: "news", label: "ข่าวสาร", description: "ประกาศ + Push + LINE", icon: Megaphone, color: "text-warning", bg: "from-warning/20 to-danger/10", url: "/dashboard/admin/news", related: ["calendar", "cms"], category: "comms" },
  { id: "documents", label: "สารบรรณ", description: "เอกสาร + เลขที่หนังสือ", icon: FileText, color: "text-warning", bg: "from-warning/20 to-warning/10", url: "/dashboard/admin/document", related: ["eform"], category: "comms" },
  { id: "eform", label: "E-Form", description: "ฟอร์ม + ลงนามดิจิทัล", icon: FileText, color: "text-danger", bg: "from-danger/20 to-danger/10", url: "/dashboard/admin/eform", related: ["documents"], category: "comms" },
  { id: "id-cards", label: "บัตรประจำตัว", description: "พิมพ์บัตรนักเรียน/บุคลากร", icon: IdCard, color: "text-danger", bg: "from-danger/20 to-info/10", url: "/dashboard/admin/print-center", roles: ["admin", "director", "teacher"], related: ["students", "personnel"], category: "core" },
  { id: "district", label: "District Feed", description: "REST API ส่งข้อมูลให้เขต", icon: Network, color: "text-info", bg: "from-info/20 to-info/10", url: "/dashboard/admin/district-feed", roles: ["admin"], related: ["students", "personnel"], category: "core" },
];

const CATEGORY_LABELS: Record<ModuleNode["category"], string> = {
  core: "ระบบหลัก",
  academic: "วิชาการ",
  student: "นักเรียน",
  hr: "บุคลากร",
  finance: "งบประมาณ",
  iot: "IoT",
  comms: "สื่อสาร",
};

export default function SpiderHubPage() {
  const { role } = useUserRole();
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const { data: metrics = {}, isFetching: metricsLoading } = useSpiderHubMetrics();

  const totalActive = Object.values(metrics).reduce((s, m) => s + (m?.count ?? 0), 0);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MODULES.filter((m) => {
      if (m.roles && role && !m.roles.includes(role as AppRole)) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        CATEGORY_LABELS[m.category].toLowerCase().includes(q)
      );
    });
  }, [role, search]);

  // group by category
  const grouped = useMemo(() => {
    const map = new Map<ModuleNode["category"], ModuleNode[]>();
    for (const m of visible) {
      if (!map.has(m.category)) map.set(m.category, []);
      map.get(m.category)!.push(m);
    }
    return Array.from(map.entries());
  }, [visible]);

  const relatedSet = useMemo(() => {
    if (!hovered) return new Set<string>();
    const node = MODULES.find((m) => m.id === hovered);
    return new Set(node?.related ?? []);
  }, [hovered]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Network className="h-7 w-7 text-primary" /> Spider Hub
            <Badge variant="outline" className="text-[10px] gap-1 ml-1">
              <span className={cn("w-1.5 h-1.5 rounded-full bg-success", !metricsLoading && "animate-pulse")} />
              LIVE
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            แผนผังโมดูล + งานค้างแบบเรียลไทม์
            {totalActive > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-warning font-medium">
                <Zap className="w-3 h-3" /> รวม {totalActive} รายการต้องดู
              </span>
            )}
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาโมดูล..."
            className="pl-9"
          />
        </div>
      </div>

      {grouped.map(([cat, mods]) => (
        <section key={cat} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{CATEGORY_LABELS[cat]}</h2>
            <Badge variant="outline">{mods.length}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {mods.map((m) => {
              const isRelated = relatedSet.has(m.id);
              const isHovered = hovered === m.id;
              const live = metrics[m.id];
              const toneClass: Record<string, string> = {
                destructive: "bg-destructive text-destructive-foreground",
                warning: "bg-warning text-warning-foreground",
                info: "bg-info text-white",
                success: "bg-success text-success-foreground",
              };
              return (
                <Link
                  to={m.url}
                  key={m.id}
                  onMouseEnter={() => setHovered(m.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="block group relative"
                >
                  <Card className={`h-full overflow-hidden border transition-all duration-300 ${
                    isHovered ? "ring-2 ring-primary scale-[1.03] shadow-xl" :
                    isRelated ? "ring-2 ring-primary/40 shadow-lg" :
                    hovered && !isRelated ? "opacity-50" : "hover:shadow-md"
                  }`}>
                    <CardContent className={`p-3 bg-gradient-to-br ${m.bg} h-full flex flex-col gap-2`}>
                      <div className="flex items-start justify-between">
                        <div className={`w-10 h-10 rounded-lg bg-background/50 backdrop-blur flex items-center justify-center ${m.color}`}>
                          <m.icon className="h-5 w-5" />
                        </div>
                        {live && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums shadow-sm flex items-center gap-1",
                            toneClass[live.tone]
                          )}>
                            <span className="w-1 h-1 rounded-full bg-white/90 animate-pulse" />
                            {live.count}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm leading-tight">{m.label}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{m.description}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                        {m.related.length > 0 ? (
                          <span className="flex items-center gap-1">
                            <Network className="h-3 w-3" /> {m.related.length} เชื่อม
                          </span>
                        ) : <span />}
                        {live && (
                          <span className="font-medium text-foreground/80 truncate">{live.label}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {visible.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            ไม่พบโมดูลที่ตรงกับ "{search}"
          </CardContent>
        </Card>
      )}
    </div>
  );
}