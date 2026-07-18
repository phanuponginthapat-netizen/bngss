import { useMemo, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Users, DollarSign, GraduationCap, Building2, Sparkles, Trash2, Plus,
} from "lucide-react";
import { EFormFillDialog } from "@/components/eform/EFormFillDialog";
import type { EFormTemplateRow } from "@/lib/eformTemplate";
import { applyCurrentOfficialPreset } from "@/lib/eformPresets";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useCmsValues } from "@/hooks/useCmsSettings";

const categoryConfig = {
  official:  { label: "หนังสือราชการ",     icon: Building2,     color: "text-blue-600" },
  personnel: { label: "แบบฟอร์มบุคลากร",   icon: Users,         color: "text-emerald-600" },
  student:   { label: "แบบฟอร์มนักเรียน",  icon: GraduationCap, color: "text-purple-600" },
  budget:    { label: "แบบฟอร์มงบประมาณ",  icon: DollarSign,    color: "text-amber-600" },
  custom:    { label: "อื่น ๆ / ที่สร้างเอง", icon: Sparkles,    color: "text-fuchsia-600" },
} as const;

type CategoryKey = keyof typeof categoryConfig;

const EFormPage = () => {
  const navigate = useNavigate();
  const { isAdmin, isDirector } = useUserRole();
  const queryClient = useQueryClient();
  const [openTemplate, setOpenTemplate] = useState<EFormTemplateRow | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["eform_templates_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("eform_templates" as any)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return ((data || []) as unknown as EFormTemplateRow[]).map(applyCurrentOfficialPreset);
    },
  });

  const cmsSettings = useCmsValues(["school_name", "school_address", "school_phone", "director_name", "director_title", "garuda_emblem", "school_seal", "school_logo"]);

  const schoolName     = (cmsSettings as any).school_name     || "โรงเรียน...";
  const schoolAddress  = (cmsSettings as any).school_address  || "";
  const schoolPhone    = (cmsSettings as any).school_phone    || "";
  const directorName   = (cmsSettings as any).director_name   || "";
  const directorTitle  = (cmsSettings as any).director_title  || "ผู้อำนวยการโรงเรียน";
  const garudaEmblem   = (cmsSettings as any).garuda_emblem   || "";
  const schoolSeal     = (cmsSettings as any).school_seal     || "";
  const schoolLogo     = (cmsSettings as any).school_logo     || "";


  // Bucket templates by category (unknown → custom)
  const grouped = useMemo(() => {
    const out: Record<CategoryKey, EFormTemplateRow[]> = {
      official: [], personnel: [], student: [], budget: [], custom: [],
    };
    for (const t of templates) {
      const k = (t.category as CategoryKey);
      if (k && out[k]) out[k].push(t);
      else out.custom.push(t);
    }
    return out;
  }, [templates]);

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`ลบต้นแบบ "${name}" ?`)) return;
    const { error } = await supabase.from("eform_templates" as any).delete().eq("id", id);
    if (error) { toast.error("ลบไม่สำเร็จ: " + error.message); return; }
    toast.success("ลบต้นแบบแล้ว");
    queryClient.invalidateQueries({ queryKey: ["eform_templates_active"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">E-Form ออกเอกสาร</h1>
          <p className="text-sm text-muted-foreground">
            เลือกต้นแบบเอกสารเพื่อกรอกข้อมูล/พิมพ์/ส่งในระบบ — ผู้ดูแลสามารถสร้างต้นแบบใหม่ได้ที่เมนู "ต้นแบบเอกสาร / E-Form"
          </p>
        </div>
        {(isAdmin || isDirector) && (
          <Button size="sm" onClick={() => navigate("/dashboard/admin/eform-templates")}>
            <Plus className="w-4 h-4 mr-1" /> สร้าง / จัดการต้นแบบ
          </Button>
        )}
      </div>

      <Tabs defaultValue="official">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          {(Object.entries(categoryConfig) as [CategoryKey, typeof categoryConfig[CategoryKey]][]).map(([key, cfg]) => (
            <TabsTrigger key={key} value={key} className="text-xs gap-1">
              <cfg.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{cfg.label}</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{grouped[key].length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(categoryConfig) as CategoryKey[]).map(cat => {
          const cfg = categoryConfig[cat];
          const list = grouped[cat];
          return (
            <TabsContent key={cat} value={cat}>
              {list.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground space-y-2">
                    <p>ยังไม่มีต้นแบบในหมวด "{cfg.label}"</p>
                    {(isAdmin || isDirector) && (
                      <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/admin/eform-templates")}>
                        <Plus className="w-4 h-4 mr-1" /> ไปสร้างต้นแบบ
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.map(t => (
                    <Card key={t.id} className="hover:shadow-md transition-shadow hover:border-primary/50 relative group">
                      <CardContent className="p-4 cursor-pointer" onClick={() => setOpenTemplate(t)}>
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-muted ${cfg.color}`}>
                            <cfg.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0 pr-7">
                            <h3 className="font-semibold text-sm text-foreground truncate">{t.name}</h3>
                            {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                            <Badge variant="outline" className="text-[10px] mt-2">{cfg.label}</Badge>
                          </div>
                        </div>
                      </CardContent>
                      {(isAdmin || isDirector) && (
                        <Button
                          size="icon" variant="ghost"
                          className="absolute top-2 right-2 h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id, t.name); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <EFormFillDialog
        open={!!openTemplate}
        onOpenChange={(o) => { if (!o) setOpenTemplate(null); }}
        template={openTemplate}
        context={{
          user: { name: "", position: "" },
          school: { name: schoolName, address: schoolAddress, phone: schoolPhone },
          director: { name: directorName, title: directorTitle },
          assets: { garuda_emblem: garudaEmblem, school_seal: schoolSeal, school_logo: schoolLogo },
        }}
      />
    </div>
  );
};

export default EFormPage;
