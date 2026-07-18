import { lazy } from "react";
import { FileText, Megaphone, FileSignature, Layers, Sparkles, AlertTriangle, Files } from "lucide-react";
import TabHubPage from "@/components/hub/TabHubPage";

const NewsPage = lazy(() => import("@/pages/admin/NewsPage"));
const DocumentPage = lazy(() => import("@/pages/admin/DocumentPage"));
const EFormPage = lazy(() => import("@/pages/admin/EFormPage"));
const EFormTemplatesPage = lazy(() => import("@/pages/admin/EFormTemplatesPage"));
const DocumentTemplatesPage = lazy(() => import("@/pages/admin/DocumentTemplatesPage"));
const EmergencyPage = lazy(() => import("@/pages/admin/EmergencyPage"));

export default function DocumentsHubPage() {
  return (
    <TabHubPage
      title="งานสารบรรณและประกาศ"
      subtitle="ข่าวประชาสัมพันธ์ หนังสือราชการ แบบฟอร์มอิเล็กทรอนิกส์ แม่แบบ และแจ้งเหตุฉุกเฉิน — รวมในหน้าเดียว"
      icon={Files}
      tabs={[
        { key: "news", label: "ข่าวประชาสัมพันธ์", icon: Megaphone, Component: NewsPage },
        { key: "documents", label: "หนังสือราชการ", icon: FileText, Component: DocumentPage },
        { key: "eform", label: "แบบฟอร์มอิเล็กทรอนิกส์", icon: FileSignature, Component: EFormPage },
        { key: "templates", label: "แม่แบบแบบฟอร์ม", icon: Layers, Component: EFormTemplatesPage },
        { key: "pdf-smart", label: "กรอก PDF อัตโนมัติ (AI)", icon: Sparkles, Component: DocumentTemplatesPage },
        { key: "emergency", label: "แจ้งเหตุฉุกเฉิน", icon: AlertTriangle, Component: EmergencyPage },
      ]}
    />
  );
}
