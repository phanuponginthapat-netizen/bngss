import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search, Save, RotateCcw, Power } from "lucide-react";
import { toast } from "sonner";
import { saveWithToast } from "@/lib/saveWithToast";
import { useLanguage } from "@/contexts/LanguageContext";
import { MODULES, GROUP_LABELS, ModuleGroup } from "@/lib/moduleRegistry";
import { useModuleToggles, saveDisabledModules } from "@/hooks/useModuleToggles";
import { useQueryClient } from "@tanstack/react-query";

const GROUP_ORDER: ModuleGroup[] = ["academic", "student", "general", "finance", "hr", "integrations", "extras"];

export default function ModuleTogglesPage() {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const { disabledKeys } = useModuleToggles();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(new Set(disabledKeys)); }, [disabledKeys]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: Record<ModuleGroup, typeof MODULES> = {
      academic: [], student: [], general: [], finance: [], hr: [], integrations: [], extras: [],
    };
    for (const m of MODULES) {
      if (q && !m.label.toLowerCase().includes(q) && !m.labelEn.toLowerCase().includes(q) && !m.desc.toLowerCase().includes(q)) continue;
      out[m.group].push(m);
    }
    return out;
  }, [search]);

  const dirty = useMemo(() => {
    if (draft.size !== disabledKeys.size) return true;
    for (const k of draft) if (!disabledKeys.has(k)) return true;
    return false;
  }, [draft, disabledKeys]);

  const toggle = (key: string, enabled: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(key); else next.add(key);
      return next;
    });
  };

  const enableAll = () => setDraft(new Set());
  const reset = () => setDraft(new Set(disabledKeys));

  const save = async () => {
    setSaving(true);
    try {
      await saveWithToast(async () => {
        await saveDisabledModules(Array.from(draft));
        await qc.invalidateQueries({ queryKey: ["module-toggles", "disabled_modules"] });
      }, {
        loading: L("กำลังบันทึกการตั้งค่าโมดูล...", "Saving module settings..."),
        success: L("บันทึกการตั้งค่าโมดูลแล้ว", "Module settings saved"),
      });
    } catch {
      /* toast already shown */
    } finally {
      setSaving(false);
    }
  };

  const totalDisabled = draft.size;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Power className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{L("เปิด-ปิดโมดูล", "Module Toggles")}</h1>
          <p className="text-sm text-muted-foreground">
            {L(
              "ซ่อนเมนูและบล็อกหน้าของโมดูลที่โรงเรียนไม่ได้ใช้ — ข้อมูลเดิมจะไม่ถูกลบ",
              "Hide menus and block pages for modules your school doesn't use — existing data is preserved.",
            )}
          </p>
        </div>
        {totalDisabled > 0 && (
          <Badge variant="secondary" className="text-sm">
            {L(`ปิดอยู่ ${totalDisabled} โมดูล`, `${totalDisabled} disabled`)}
          </Badge>
        )}
      </div>

      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertTitle>{L("ข้อควรทราบ", "Note")}</AlertTitle>
        <AlertDescription>
          {L(
            "โมดูลหลัก (หน้าหลัก, โปรไฟล์, จัดการผู้ใช้, ระบบ & Cloud, Module Hub, จัดการวิชาการ, นักเรียน DMC) ไม่สามารถปิดได้ เพื่อให้ระบบทำงานปกติ",
            "Core modules (Home, Profile, Users, System Settings, Module Hub, Academic Management, Students DMC) cannot be disabled.",
          )}
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 items-center sticky top-0 z-10 bg-background/90 backdrop-blur py-2 -mx-1 px-1 rounded">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L("ค้นหาโมดูล...", "Search modules...")}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={enableAll} disabled={draft.size === 0}>
          {L("เปิดทั้งหมด", "Enable all")}
        </Button>
        <Button variant="outline" size="sm" onClick={reset} disabled={!dirty}>
          <RotateCcw className="w-4 h-4 mr-1" /> {L("ย้อนกลับ", "Reset")}
        </Button>
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? L("กำลังบันทึก...", "Saving...") : L("บันทึก", "Save")}
        </Button>
      </div>

      {GROUP_ORDER.map((g) => {
        const items = grouped[g];
        if (!items.length) return null;
        return (
          <Card key={g} className="border-0 shadow-elevated rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">{L(GROUP_LABELS[g].th, GROUP_LABELS[g].en)}</CardTitle>
              <CardDescription>
                {items.filter(i => !draft.has(i.key)).length} / {items.length} {L("เปิดอยู่", "enabled")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((m) => {
                const enabled = !draft.has(m.key);
                return (
                  <div
                    key={m.key}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${enabled ? "bg-card" : "bg-muted/40 opacity-70"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{L(m.label, m.labelEn)}</span>
                        {!enabled && <Badge variant="outline" className="text-xs">{L("ปิดอยู่", "Disabled")}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={(v) => toggle(m.key, v)} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <div className="bg-card border shadow-elevated rounded-full px-4 py-2 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{L("มีการเปลี่ยนแปลงที่ยังไม่บันทึก", "Unsaved changes")}</span>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> {L("บันทึก", "Save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
