import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, Users, ClipboardList, GraduationCap } from "lucide-react";
import TeacherSubjectPage from "./TeacherSubjectPage";
import ClassroomManagementPage from "./ClassroomManagementPage";
import EnrollmentPage from "./EnrollmentPage";

const AcademicManagementPage = () => {
  const { lang } = useLanguage();

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-primary">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">
                {lang === "th" ? "วิชาการ" : "Academic"}
              </CardTitle>
              <CardDescription>
                {lang === "th" ? "รายวิชา ครูผู้สอน ห้องเรียน และการลงทะเบียน" : "Subjects, teachers, classrooms and enrollment"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="subjects" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="subjects" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === "th" ? "รายวิชา/ครู" : "Subjects/Teachers"}</span>
            <span className="sm:hidden">{lang === "th" ? "วิชา" : "Subjects"}</span>
          </TabsTrigger>
          <TabsTrigger value="classrooms" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === "th" ? "ห้องเรียน/นักเรียน" : "Classrooms/Students"}</span>
            <span className="sm:hidden">{lang === "th" ? "ห้อง" : "Classes"}</span>
          </TabsTrigger>
          <TabsTrigger value="enrollment" className="gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            {lang === "th" ? "ลงทะเบียน" : "Enrollment"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subjects">
          <TeacherSubjectPage />
        </TabsContent>
        <TabsContent value="classrooms">
          <ClassroomManagementPage />
        </TabsContent>
        <TabsContent value="enrollment">
          <EnrollmentPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AcademicManagementPage;
