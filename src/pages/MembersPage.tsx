import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolContext } from "@/hooks/useSchoolContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Briefcase } from "lucide-react";

interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  position_title: string | null;
  department: string | null;
  email: string | null;
  employee_code: string | null;
  student_code: string | null;
}

export default function MembersPage() {
  const { schoolId } = useSchoolContext();
  const { userId, role } = useUserRole();
  const { isOnline, onlineIds } = useOnlinePresence();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "online" | "staff" | "student">("all");

  // Students should not see email / employee_code of other members
  const canSeeSensitive = role === "admin" || role === "director" || role === "teacher";

  const { data: members = [], isLoading, refetch } = useQuery({
    queryKey: ["school-members", userId, schoolId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_school_members");
      if (error) throw error;
      return (data || []) as Member[];
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const visibleMembers = useMemo(() => {
    if (canSeeSensitive) return members;
    // Mask sensitive fields for non-staff
    return members.map((m) => ({
      ...m,
      email: null,
      employee_code: null,
    }));
  }, [members, canSeeSensitive]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = visibleMembers;
    if (kind === "staff") arr = arr.filter(m => !!m.employee_code);
    else if (kind === "student") arr = arr.filter(m => !!m.student_code);
    else if (kind === "online") arr = arr.filter(m => onlineIds.has(m.id));
    if (!s) return arr;
    return arr.filter(m =>
      `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase().includes(s) ||
      (m.position_title ?? "").toLowerCase().includes(s) ||
      (m.department ?? "").toLowerCase().includes(s) ||
      (m.email ?? "").toLowerCase().includes(s) ||
      (m.employee_code ?? "").toLowerCase().includes(s) ||
      (m.student_code ?? "").toLowerCase().includes(s)
    );
  }, [visibleMembers, q, kind, onlineIds]);

  const counts = useMemo(() => ({
    all: visibleMembers.length,
    online: visibleMembers.filter(m => onlineIds.has(m.id)).length,
    staff: visibleMembers.filter(m => !!m.employee_code).length,
    student: visibleMembers.filter(m => !!m.student_code).length,
  }), [visibleMembers, onlineIds]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Users className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">สมาชิกโรงเรียน</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            คลิกการ์ดเพื่อดูโปรไฟล์และผลงาน
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              ออนไลน์ {onlineIds.size} คน
            </span>
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อ, อีเมล, รหัสบุคลากร/นักเรียน, ตำแหน่ง หรือฝ่ายงาน..."
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          { k: "all", label: "ทั้งหมด" },
          { k: "online", label: "ออนไลน์" },
          { k: "staff", label: "ครู/บุคลากร" },
          { k: "student", label: "นักเรียน" },
        ] as const).map(({ k, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5 ${
              kind === k
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border text-foreground"
            }`}
          >
            {k === "online" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
            {label} <span className="opacity-70">({counts[k]})</span>
          </button>
        ))}
      </div>


      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">ไม่พบสมาชิก</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(m => {
            const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || "ผู้ใช้";
            const ini = `${m.first_name?.[0] ?? ""}${m.last_name?.[0] ?? ""}`.toUpperCase() || "?";
            return (
              <Link key={m.id} to={`/p/${m.id}`}>
                <Card className="hover:shadow-elevated transition-all hover:-translate-y-0.5">
                  <CardContent className="p-4 text-center space-y-2">
                    <div className="relative w-16 h-16 mx-auto">
                      <Avatar className="w-16 h-16 border-2 border-background shadow">
                        <AvatarImage src={m.avatar_url ?? undefined} alt={name} />
                        <AvatarFallback className="gradient-primary text-primary-foreground font-bold">{ini}</AvatarFallback>
                      </Avatar>
                      {isOnline(m.id) && (
                        <span
                          title="ออนไลน์"
                          className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background shadow"
                        />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-sm truncate flex items-center justify-center gap-1">
                        {name}
                      </p>
                      {m.position_title && (
                        <p className="text-xs text-muted-foreground truncate flex items-center justify-center gap-1">
                          <Briefcase className="w-3 h-3" />{m.position_title}
                        </p>
                      )}
                      {m.department && <Badge variant="outline" className="text-[10px] mt-1">{m.department}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
