import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Save, Eye, EyeOff, Plus, Trash2, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { swal } from "@/lib/swal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSecretGuide } from "@/lib/secretGuides";

const CATEGORY_LABEL: Record<string, { th: string; en: string }> = {
  ai: { th: "ปัญญาประดิษฐ์ (AI)", en: "AI" },
  social: { th: "Social", en: "Social" },
  line: { th: "LINE", en: "LINE" },
  push: { th: "Push Notification", en: "Push Notification" },
  notifications: { th: "การแจ้งเตือน", en: "Notifications" },
  general: { th: "ทั่วไป", en: "General" },
};

export default function SecretsManagementPage() {
  const qc = useQueryClient();
  const { lang } = useLanguage();
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("general");

  // Auto-seed default secret entries so the form is never empty after a remix
  useEffect(() => {
    supabase.rpc("ensure_default_app_secrets" as any).then(() => {
      qc.invalidateQueries({ queryKey: ["app_secrets"] });
    });
  }, [qc]);

  const { data: secrets = [] } = useQuery({
    queryKey: ["app_secrets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_secrets" as any)
        .select("key,description,category,updated_at,value")
        .order("category")
        .order("key");
      if (error) throw error;
      return (data || []).map((s: any) => ({ ...s, has_value: !!(s.value && s.value.length > 0) })) as any[];
    },
  });



  const save = async (key: string) => {
    const value = drafts[key];
    if (value === undefined) return;
    const { error } = await supabase
      .from("app_secrets" as any)
      .update({ value, updated_at: new Date().toISOString() } as any)
      .eq("key", key);
    if (error) return toast.error(error.message);
    toast.success(lang === "th" ? "บันทึก " + key + " แล้ว" : "Saved " + key);
    setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
    qc.invalidateQueries({ queryKey: ["app_secrets"] });
  };

  const addNew = async () => {
    if (!newKey.match(/^[A-Z][A-Z0-9_]+$/)) {
      toast.error(lang === "th" ? "Key ต้องเป็น UPPER_SNAKE_CASE" : "Key must be UPPER_SNAKE_CASE");
      return;
    }
    const { error } = await supabase
      .from("app_secrets" as any)
      .insert({ key: newKey, description: newDesc || null, category: newCat } as any);
    if (error) return toast.error(error.message);
    toast.success(lang === "th" ? "เพิ่มแล้ว" : "Added");
    setNewKey(""); setNewDesc("");
    qc.invalidateQueries({ queryKey: ["app_secrets"] });
  };

  const remove = async (key: string) => {
    if (!(await swal.confirm({ title: lang === "th" ? `ลบ ${key}?` : `Delete ${key}?`, danger: true }))) return;
    await supabase.from("app_secrets" as any).delete().eq("key", key);
    qc.invalidateQueries({ queryKey: ["app_secrets"] });
  };

  const grouped = secrets.reduce<Record<string, any[]>>((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <KeyRound className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{lang === "th" ? "API Keys / Secrets" : "API Keys / Secrets"}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "หน้ารวมตั้งค่า Secret ทุกตัว — กรอกได้ภายหลัง Remix ไม่ต้องตั้งใน Cloud Settings"
              : "Central place to fill in all API keys after remixing — no Cloud Settings needed"}
          </p>
        </div>
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle>{CATEGORY_LABEL[cat]?.[lang as "th" | "en"] || cat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {list.map((s: any) => {
              const hasValue = !!s.has_value;
              const draft = drafts[s.key];
              const visible = show[s.key];
              return (
                <div key={s.key} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Label className="font-mono text-sm">{s.key}</Label>
                        {(() => {
                          const g = getSecretGuide(s.key);
                          if (!g) return null;
                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5" title="วิธีหา API Key">
                                  <Info className="h-3.5 w-3.5 text-primary" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 text-sm space-y-2">
                                <div className="font-semibold">{g.title}</div>
                                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                                  {g.steps.map((st, i) => <li key={i}>{st}</li>)}
                                </ol>
                                {g.url && (
                                  <a href={g.url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                    <ExternalLink className="h-3 w-3" /> เปิดหน้าเว็บ
                                  </a>
                                )}
                              </PopoverContent>
                            </Popover>
                          );
                        })()}
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasValue
                        ? <Badge variant="default" className="bg-success">{lang === "th" ? "ตั้งแล้ว" : "Set"}</Badge>
                        : <Badge variant="secondary">{lang === "th" ? "ยังไม่ได้ตั้ง" : "Not set"}</Badge>}
                      <Button variant="ghost" size="icon" onClick={() => remove(s.key)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={visible ? "text" : "password"}
                        value={draft ?? (s.value ?? "")}
                        onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                        placeholder={lang === "th" ? "วางค่าที่นี่..." : "Paste value..."}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShow((sh) => ({ ...sh, [s.key]: !visible }))}
                      >
                        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <Button onClick={() => save(s.key)} disabled={draft === undefined}>
                      <Save className="h-4 w-4 mr-1" />
                      {lang === "th" ? "บันทึก" : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>{lang === "th" ? "เพิ่ม Secret ใหม่" : "Add New Secret"}</CardTitle>
          <CardDescription>
            {lang === "th" ? "ใช้ชื่อ UPPER_SNAKE_CASE เช่น STRIPE_API_KEY" : "Use UPPER_SNAKE_CASE name, e.g. STRIPE_API_KEY"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-2">
          <Input placeholder="MY_API_KEY" value={newKey} onChange={(e) => setNewKey(e.target.value.toUpperCase())} className="font-mono" />
          <Input placeholder={lang === "th" ? "คำอธิบาย" : "Description"} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <Input placeholder="category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button onClick={addNew}><Plus className="h-4 w-4 mr-1" />{lang === "th" ? "เพิ่ม" : "Add"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
