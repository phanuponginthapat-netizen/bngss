import { Link, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import { areaUrl, buildWorkAreas, findWorkArea, visibleWorkAreas } from "@/lib/navigation/workAreas";

export default function WorkAreaBreadcrumb() {
  const { pathname } = useLocation();
  const { lang } = useLanguage();
  const { role } = useUserRole();
  const { isModuleEnabled } = useModuleToggles();
  const area = findWorkArea(visibleWorkAreas(buildWorkAreas(lang), role, isModuleEnabled), pathname);
  if (!area || pathname === areaUrl(area.key)) return null;
  return <nav aria-label="กลับหน้าหลักฝ่าย" className="mb-4"><Button asChild variant="ghost" size="sm"><Link to={areaUrl(area.key)}><ChevronLeft />{area.label}</Link></Button></nav>;
}