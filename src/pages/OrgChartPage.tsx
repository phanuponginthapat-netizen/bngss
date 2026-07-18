import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap, Users, Building2 } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import SystemLoader from "@/components/SystemLoader";

interface OrgPerson {
  id: string;
  user_id: string | null;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  position_title: string | null;
  position_level: string | null;
  department: string | null;
  subject_group: string | null;
  academic_standing: string | null;
  avatar_url: string | null;
  sort_rank: number | null;
}

const DEPT_ORDER = ["บริหาร", "วิชาการ", "บริหารทั่วไป", "งบประมาณและแผน", "บุคคล", "กิจการนักเรียน"];

// แปลงชื่อฝ่ายในฐานข้อมูลให้เป็นกลุ่มมาตรฐาน + แยก "งบประมาณและบุคคล" เป็น 2 ฝ่าย
const normalizeDepartments = (raw: string | null): string[] => {
  const s = (raw || "").trim();
  if (!s) return ["อื่น ๆ"];
  // ฝ่ายผสม — แสดงในทั้งสองฝ่าย
  if (/งบประมาณ.*บุคคล|บุคคล.*งบประมาณ/.test(s)) return ["งบประมาณและแผน", "บุคคล"];
  if (/แผนงาน|ประกันคุณภาพ/.test(s)) return ["งบประมาณและแผน"];
  if (/งบประมาณ/.test(s)) return ["งบประมาณและแผน"];
  if (/บุคคล/.test(s)) return ["บุคคล"];
  if (/วิชาการ/.test(s)) return ["วิชาการ"];
  if (/ทั่วไป|อาคาร|สถานที่/.test(s)) return ["บริหารทั่วไป"];
  if (/กิจการนักเรียน|กิจการนร|ปกครอง/.test(s)) return ["กิจการนักเรียน"];
  if (/^บริหาร$|ผู้บริหาร|ผอ\.|ผู้อำนวยการ|รองผอ/.test(s)) return ["บริหาร"];
  return [s];
};

const PersonCard = ({ p, featured = false }: { p: OrgPerson; featured?: boolean }) => {
  const fullName = [p.prefix, p.first_name, p.last_name].filter(Boolean).join(" ");
  const initials = (p.first_name?.[0] || "") + (p.last_name?.[0] || "");
  const inner = (
    <Card className={`group transition-all hover:shadow-lg hover:-translate-y-0.5 ${featured ? "ring-2 ring-primary/30" : ""}`}>
      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
        <Avatar className={`${featured ? "w-24 h-24" : "w-20 h-20"} ring-2 ring-primary/10`}>
          <AvatarImage src={p.avatar_url || undefined} alt={fullName} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials || <Users className="w-6 h-6" />}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-0.5">
          <div className={`font-semibold leading-tight ${featured ? "text-base" : "text-sm"}`}>{fullName || "-"}</div>
          {p.position_title && (
            <div className="text-xs text-muted-foreground">{p.position_title}</div>
          )}
          {p.position_level && (
            <Badge variant="secondary" className="text-[10px] mt-1">{p.position_level}</Badge>
          )}
          {p.subject_group && (
            <div className="text-[11px] text-muted-foreground mt-1">กลุ่มสาระ: {p.subject_group}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
  return p.user_id ? <Link to={`/p/${p.user_id}`}>{inner}</Link> : inner;
};

const OrgChartPage = () => {
  const { appName } = useSystemSettings();
  const [people, setPeople] = useState<OrgPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `ผังบุคลากร · ${appName || "โรงเรียน"}`;
  }, [appName]);

  useEffect(() => {
    let cancelled = false;
    const fetchChart = async () => {
      const { data } = await (supabase.rpc as any)("get_public_org_chart");
      if (cancelled) return;
      setPeople((data as OrgPerson[]) || []);
      setLoading(false);
    };
    fetchChart();

    const channel = supabase
      .channel("org-chart-personnel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "personnel" },
        () => fetchChart()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const { leadership, byDept } = useMemo(() => {
    const lead = people.filter((p) => (p.sort_rank ?? 99) <= 2);
    const rest = people.filter((p) => (p.sort_rank ?? 99) > 2);
    const map = new Map<string, OrgPerson[]>();
    rest.forEach((p) => {
      const keys = normalizeDepartments(p.department);
      keys.forEach((k) => {
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(p);
      });
    });
    const sorted = Array.from(map.entries()).sort(([a], [b]) => {
      const ai = DEPT_ORDER.indexOf(a);
      const bi = DEPT_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, "th");
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return { leadership: lead, byDept: sorted };
  }, [people]);

  if (loading) return <SystemLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> กลับสู่หน้าหลัก
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="w-4 h-4 text-primary" />
            {appName}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        <section className="text-center space-y-3">
          <Badge variant="secondary" className="rounded-full">ผังโครงสร้างองค์กร</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">ผังฝ่ายงานและบุคลากร</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            ข้อมูลโครงสร้างฝ่ายงานและบุคลากรของโรงเรียน อัปเดตอัตโนมัติจากระบบบริหารงานบุคคล
          </p>
        </section>

        {people.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              ยังไม่มีข้อมูลบุคลากรในระบบ
            </CardContent>
          </Card>
        )}

        {leadership.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">ฝ่ายบริหาร</h2>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {leadership.map((p) => (
                <div key={p.id} className="w-56">
                  <PersonCard p={p} featured />
                </div>
              ))}
            </div>
          </section>
        )}

        {byDept.map(([dept, members]) => (
          <section key={dept} className="space-y-4">
            <div className="flex items-center gap-2 border-l-4 border-primary pl-3">
              <h2 className="text-lg font-semibold">{dept}</h2>
              <Badge variant="outline">{members.length} คน</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {members.map((p) => (
                <PersonCard key={p.id} p={p} />
              ))}
            </div>
          </section>
        ))}

        <div className="text-center pt-6 flex justify-center gap-2">
          <Link to="/subject-groups">
            <Button variant="outline">ผังกลุ่มสาระการเรียนรู้</Button>
          </Link>
          <Link to="/find">
            <Button variant="outline">ค้นหาบุคคล</Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default OrgChartPage;
