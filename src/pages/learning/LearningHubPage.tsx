import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Play, Search, Youtube, FileText, Gamepad2, Globe, Settings } from "lucide-react";
import LearningPlayer from "@/components/learning/LearningPlayer";
import { getKindLabel } from "@/lib/learningProxy";
import { useUserRole } from "@/hooks/useUserRole";

const KIND_ICON: Record<string, any> = {
  html_single: FileText, html_zip: Gamepad2, youtube: Youtube, vimeo: Youtube, pdf: FileText, embed: Globe,
};

export default function LearningHubPage() {
  const navigate = useNavigate();
  const { isAdmin, isDirector, isTeacher } = useUserRole();
  const canManage = isAdmin || isDirector || isTeacher;
  const [playing, setPlaying] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState<string>("all");
  const [group, setGroup] = useState<string>("all");

  const { data: contents = [] } = useQuery({
    queryKey: ["learning_contents_hub"],
    queryFn: async () => {
      const { data } = await supabase
        .from("learning_contents")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = contents.filter((c: any) => {
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !(c.description || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (grade !== "all" && c.grade_level !== "all" && c.grade_level !== grade) return false;
    if (group !== "all" && c.subject_group !== group) return false;
    return true;
  });

  const allGroups = Array.from(new Set(contents.map((c: any) => c.subject_group).filter(Boolean)));
  const allGrades = Array.from(new Set(contents.map((c: any) => c.grade_level).filter((g: any) => g && g !== "all")));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
          <GraduationCap className="w-6 h-6 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">สื่อการเรียนรู้ (E-Learning)</h1>
          <p className="text-sm text-muted-foreground">เกม สื่อ และวิดีโอที่ครูแขวนไว้ — เปิดเล่นได้เลย</p>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => navigate("/dashboard/academic/learning")}>
            <Settings className="w-4 h-4 mr-2" /> จัดการสื่อ
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-3 grid gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="ค้นหาสื่อ..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger><SelectValue placeholder="ระดับชั้น" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกระดับชั้น</SelectItem>
              {allGrades.map((g: any) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger><SelectValue placeholder="กลุ่มสาระ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกกลุ่มสาระ</SelectItem>
              {allGroups.map((g: any) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          ยังไม่มีสื่อในหมวดนี้
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any) => {
            const Icon = KIND_ICON[c.kind] || FileText;
            return (
              <Card key={c.id} className="group hover:shadow-lg transition cursor-pointer" onClick={() => setPlaying(c)}>
                <CardContent className="p-4 space-y-3">
                  <div className="aspect-video rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <Icon className="w-12 h-12 text-primary/60" />
                  </div>
                  <div>
                    <h3 className="font-semibold line-clamp-1">{c.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.description || "—"}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">{getKindLabel(c.kind)}</Badge>
                    {c.grade_level && c.grade_level !== "all" && <Badge variant="outline" className="text-[10px]">{c.grade_level}</Badge>}
                    {c.subject_group && <Badge variant="outline" className="text-[10px]">{c.subject_group}</Badge>}
                  </div>
                  <Button className="w-full" size="sm">
                    <Play className="w-3 h-3 mr-1" /> เปิดเล่น
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {playing && <LearningPlayer content={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
