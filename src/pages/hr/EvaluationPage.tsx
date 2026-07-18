import { useState, lazy, Suspense } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, FileText, ClipboardCheck, Brain } from "lucide-react";
import PASystemTab from "@/components/evaluation/PASystemTab";
import PAReportTab from "@/components/evaluation/PAReportTab";
import LegacyEvaluationTab from "@/components/evaluation/LegacyEvaluationTab";

const PersonnelAssessmentPage = lazy(() => import("./PersonnelAssessmentPage"));

const EvaluationPage = () => {
  const { isAdmin, isDirector } = useUserRole();
  const canManageAll = isAdmin || isDirector;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Star className="w-6 h-6 text-primary" />
          ระบบ PA / ประเมินวิทยฐานะ
        </h1>
        <p className="text-sm text-muted-foreground">
          ข้อตกลงในการพัฒนางาน (PA) ตามหลักเกณฑ์ ว PA สพฐ.
        </p>
      </div>

      <Tabs defaultValue="pa">
        <TabsList>
          <TabsTrigger value="pa" className="gap-1.5">
            <ClipboardCheck className="w-4 h-4" />
            ข้อตกลง PA
          </TabsTrigger>
          {canManageAll && (
            <TabsTrigger value="report" className="gap-1.5">
              <FileText className="w-4 h-4" />
              รายงาน ผอ.
            </TabsTrigger>
          )}
          {canManageAll && (
            <TabsTrigger value="legacy" className="gap-1.5">
              <Star className="w-4 h-4" />
              ประเมินทั่วไป
            </TabsTrigger>
          )}
          <TabsTrigger value="disc" className="gap-1.5">
            <Brain className="w-4 h-4" />
            DISC & สุขภาพจิต
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pa">
          <PASystemTab />
        </TabsContent>
        {canManageAll && (
          <TabsContent value="report">
            <PAReportTab />
          </TabsContent>
        )}
        {canManageAll && (
          <TabsContent value="legacy">
            <LegacyEvaluationTab />
          </TabsContent>
        )}
        <TabsContent value="disc">
          <Suspense fallback={<div className="text-center py-12 text-muted-foreground">กำลังโหลด...</div>}>
            <PersonnelAssessmentPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EvaluationPage;
