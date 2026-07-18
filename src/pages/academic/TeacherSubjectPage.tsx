import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, UserCheck } from "lucide-react";
import { CurriculumUploadDialog } from "@/components/academic/CurriculumUploadDialog";
import { SubjectsTab } from "@/components/academic/SubjectsTab";
import { AssignmentsTab } from "@/components/academic/AssignmentsTab";

const TeacherSubjectPage = () => {
  const { lang } = useLanguage();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const { data } = await supabase.from("personnel").select("*").eq("status", "active").order("first_name");
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("*").order("code");
      return data || [];
    },
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ["classrooms"],
    queryFn: async () => {
      const { data } = await supabase.from("classrooms").select("*").order("name");
      return data || [];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["teacher_assignments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teacher_assignments")
        .select("*, personnel(*), subjects(*), classrooms(*)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">รายวิชาทั้งหมด</p><p className="text-3xl font-bold">{subjects.length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">ครูผู้สอน</p><p className="text-3xl font-bold">{personnel.length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">การมอบหมาย</p><p className="text-3xl font-bold">{assignments.length}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="subjects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subjects" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" /> รายวิชา</TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1.5"><UserCheck className="w-3.5 h-3.5" /> มอบหมายครู</TabsTrigger>
        </TabsList>
        <TabsContent value="subjects">
          <SubjectsTab subjects={subjects} onUploadOpen={() => setUploadOpen(true)} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab assignments={assignments} personnel={personnel} subjects={subjects} classrooms={classrooms} />
        </TabsContent>
      </Tabs>

      <CurriculumUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
};

export default TeacherSubjectPage;
