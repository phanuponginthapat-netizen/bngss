import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpenCheck, Crown, Users } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import SystemLoader from "@/components/SystemLoader";
import { SUBJECT_GROUP_DEFS, toSubjectGroupCode, type SubjectGroupCode } from "@/lib/subjectGroupMap";

interface Person {
  user_id: string;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  position_title: string | null;
  avatar_url: string | null;
  subject_group: string | null;
}

type SgPosition = "head" | "deputy" | "secretary";

const POSITION_LABEL: Record<SgPosition, string> = {
  head: "หัวหน้ากลุ่มสาระ",
  deputy: "รองหัวหน้ากลุ่มสาระ",
  secretary: "เลขานุการกลุ่มสาระ",
};
const POSITION_COLOR: Record<SgPosition, string> = {
  head: "bg-warning text-white",
  deputy: "bg-info text-white",
  secretary: "bg-secondary text-secondary-foreground",
};
const POSITION_RING: Record<SgPosition, string> = {
  head: "ring-warning/60",
  deputy: "ring-info/60",
  secretary: "ring-secondary/60",
};

const PersonCard = ({ p, position }: { p: Person; position?: SgPosition }) => {
  const fullName = [p.prefix, p.first_name, p.last_name].filter(Boolean).join(" ");
  const initials = (p.first_name?.[0] || "") + (p.last_name?.[0] || "");
  const isLeader = !!position;
  const inner = (
    <Card className={`group transition-all hover:shadow-lg hover:-translate-y-0.5 h-full ${isLeader ? `ring-2 ${POSITION_RING[position!]}` : ""}`}>
      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
        <div className="relative">
          <Avatar className={`${isLeader ? "w-24 h-24" : "w-20 h-20"} ring-2 ring-primary/10`}>
            <AvatarImage src={p.avatar_url || undefined} alt={fullName} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials || <Users className="w-6 h-6" />}
            </AvatarFallback>
          </Avatar>
          {position === "head" && (
            <div className="absolute -top-1 -right-1 bg-warning text-white rounded-full p-1 shadow">
              <Crown className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <div className={`font-semibold leading-tight ${isLeader ? "text-base" : "text-sm"}`}>{fullName || "-"}</div>
          {p.position_title && (
            <div className="text-xs text-muted-foreground">{p.position_title}</div>
          )}
          {position && (
            <Badge variant="secondary" className={`text-[10px] mt-1 border-0 ${POSITION_COLOR[position]}`}>
              {POSITION_LABEL[position]}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
  return p.user_id ? <Link to={`/p/${p.user_id}`}>{inner}</Link> : inner;
};

const SubjectGroupChartPage = () => {
  const { appName } = useSystemSettings();
  const [people, setPeople] = useState<Person[]>([]);
  const [heads, setHeads] = useState<{ user_id: string; subject_group: SubjectGroupCode; position: SgPosition }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `ผังกลุ่มสาระการเรียนรู้ · ${appName || "โรงเรียน"}`;
    (async () => {
      const { data: personnel } = await supabase
        .from("personnel")
        .select("user_id, prefix, first_name, last_name, position, subject_group")
        .not("subject_group", "is", null);
      const userIds = (personnel || []).map((p: any) => p.user_id).filter(Boolean);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, avatar_url, position_title").in("id", userIds)
        : { data: [] as any[] } as any;
      const profMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));
      const list: Person[] = (personnel || [])
        .filter((p: any) => p.user_id)
        .map((p: any) => ({
          user_id: p.user_id,
          prefix: p.prefix,
          first_name: p.first_name,
          last_name: p.last_name,
          position_title: profMap.get(p.user_id)?.position_title || p.position || null,
          avatar_url: profMap.get(p.user_id)?.avatar_url || null,
          subject_group: p.subject_group,
        }));
      setPeople(list);

      const { data: h } = await supabase
        .from("subject_group_heads")
        .select("user_id, subject_group, position");
      setHeads((h || []) as any);
      setLoading(false);
    })();
  }, [appName]);

  const groups = useMemo(() => {
    const posMap = new Map<string, Map<string, SgPosition>>(); // group → (user_id → position)
    for (const h of heads) {
      const inner = posMap.get(h.subject_group) || new Map<string, SgPosition>();
      inner.set(h.user_id, h.position);
      posMap.set(h.subject_group, inner);
    }
    return SUBJECT_GROUP_DEFS.map((def) => {
      const members = people.filter((p) => toSubjectGroupCode(p.subject_group) === def.code);
      const inner = posMap.get(def.code) || new Map<string, SgPosition>();
      const leaders = (pos: SgPosition) => members.filter((m) => inner.get(m.user_id) === pos);
      const heads = leaders("head");
      const deputies = leaders("deputy");
      const secretaries = leaders("secretary");
      const leaderIds = new Set([...heads, ...deputies, ...secretaries].map((m) => m.user_id));
      const rest = members.filter((m) => !leaderIds.has(m.user_id));
      return { def, heads, deputies, secretaries, members: rest, total: members.length };
    });
  }, [people, heads]);

  if (loading) return <SystemLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> กลับสู่หน้าหลัก
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpenCheck className="w-4 h-4 text-primary" />
            {appName}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <section className="text-center space-y-3">
          <Badge variant="secondary" className="rounded-full">ผังกลุ่มสาระการเรียนรู้</Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">หัวหน้าและสมาชิกกลุ่มสาระ</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            แสดงหัวหน้า / รองหัวหน้า / เลขานุการ และสมาชิกของแต่ละกลุ่มสาระตามข้อมูลผู้ใช้งานในระบบ
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Link to="/org-chart"><Button variant="outline" size="sm">ผังบุคลากร</Button></Link>
            <Link to="/find"><Button variant="outline" size="sm">ค้นหาบุคคล</Button></Link>
          </div>
        </section>

        {groups.map(({ def, heads, deputies, secretaries, members, total }) => {
          const leaderCount = heads.length + deputies.length + secretaries.length;
          return (
            <section key={def.code} className="space-y-4">
              <div className="flex items-center gap-3 border-l-4 border-primary pl-3">
                <BookOpenCheck className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{def.th}</h2>
                <Badge variant="outline">{total} คน</Badge>
                {leaderCount > 0 && (
                  <Badge className="bg-warning-soft text-warning hover:bg-warning-soft">
                    <Crown className="w-3 h-3 mr-1" /> {leaderCount} ผู้บริหาร
                  </Badge>
                )}
              </div>
              {total === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีสมาชิกในกลุ่มสาระนี้</CardContent></Card>
              ) : (
                <>
                  {(heads.length + deputies.length + secretaries.length) > 0 && (
                    <div className="flex flex-wrap gap-4 justify-center">
                      {heads.map((p) => <div key={p.user_id} className="w-48"><PersonCard p={p} position="head" /></div>)}
                      {deputies.map((p) => <div key={p.user_id} className="w-44"><PersonCard p={p} position="deputy" /></div>)}
                      {secretaries.map((p) => <div key={p.user_id} className="w-44"><PersonCard p={p} position="secretary" /></div>)}
                    </div>
                  )}
                  {members.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {members.map((p) => <PersonCard key={p.user_id} p={p} />)}
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
};

export default SubjectGroupChartPage;
