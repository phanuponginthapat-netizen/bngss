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
import { SECRET_PRESET_CATEGORIES, type SecretPreset } from "@/lib/secretPresets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, ExternalLink as ExtLinkIcon } from "lucide-react";
import { saveErrorMessage } from "@/lib/saveError";

const CATEGORY_LABEL: Record<string, { th: string; en: string }> = {
  social: { th: "Social", en: "Social" },
  line: { th: "LINE", en: "LINE" },
  push: { th: "Push Notification", en: "Push Notification" },
  notifications: { th: "การแจ้งเตือน", en: "Notifications" },
  general: { th: "ทั่วไป", en: "General" },
};

// AI keys อยู่ในแท็บ "ผู้ให้บริการ AI" (ตาราง ai_providers) — ซ่อนจากหน้านี้เพื่อไม่ให้ซ้ำ
const HIDDEN_CATEGORIES = new Set(["ai"]);

export default function SecretsManagementPage() {
  const qc = useQueryClient();
  const { lang } = useLanguage();
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("general");
  const [presetCat, setPresetCat] = useState<string>(SECRET_PRESET_CATEGORIES[0].id);
  const [presetKey, setPresetKey] = useState<string>("");
  const [customMode, setCustomMode] = useState(false);

  // Auto-seed default secret entries + mirror project env vars into DB so
  // auto-provisioned secrets (VAPID/CRON) show as "ตั้งแล้ว" immediately.
  useEffect(() => {
    (async () => {
      await supabase.rpc("ensure_default_app_secrets" as any);
      try { await supabase.functions.invoke("sync-env-secrets"); } catch (_) { /* ignore */ }
      qc.invalidateQueries({ queryKey: ["app_secrets"] });
    })();
  }, [qc]);

  const { data: secrets = [] } = useQuery({
    queryKey: ["app_secrets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_secrets_meta" as any)
        .select("key,description,category,updated_at,has_value")
        .order("category")
        .order("key");
      if (error) throw error;
      return (data || []) as any[];
    },
  });


  const save = async (key: string) => {
    const value = drafts[key];
    if (value === undefined) return;
    const { error } = await supabase
      .from("app_secrets" as any)
      .update({ value, updated_at: new Date().toISOString() } as any)
      .eq("key", key);
    if (error) return toast.error(saveErrorMessage(error));
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
    if (error) return toast.error(saveErrorMessage(error));
    toast.success(lang === "th" ? "เพิ่มแล้ว" : "Added");
    setNewKey(""); setNewDesc("");
    qc.invalidateQueries({ queryKey: ["app_secrets"] });
  };

  const remove = async (key: string) => {
    if (!(await swal.confirm({ title: lang === "th" ? `ลบ ${key}?` : `Delete ${key}?`, danger: true }))) return;
    await supabase.from("app_secrets" as any).delete().eq("key", key);
    qc.invalidateQueries({ queryKey: ["app_secrets"] });
  };

  const grouped = secrets
    .filter((s) => !HIDDEN_CATEGORIES.has(s.category))
    .reduce<Record<string, any[]>>((acc, s) => {
      (acc[s.category] = acc[s.category] || []).push(s);
      return acc;
    }, {});

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <KeyRound className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{lang === "th" ? "API Keys / Secrets" : "API Keys / Secrets"}</h1>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {lang === "th"
              ? "'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n                                            \n                                            เช็ค extension กับ linux kiosk แก้บัคให้ใช้งานได้"
              : "'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n                                            \n                                            เช็ค extension กับ linux kiosk แก้บัคให้ใช้งานได้"}
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
                        ? <Badge variant="default" className="bg-green-600">{lang === "th" ? "ตั้งแล้ว" : "Set"}</Badge>
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
                        value={draft ?? (hasValue ? "••••••••••••" : "")}
                        onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                        onFocus={(e) => { if (draft === undefined) { setDrafts((d) => ({ ...d, [s.key]: "" })); e.currentTarget.value = ""; }}}
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
            {lang === "th"
              ? "เลือกจากรายการที่มีให้ หรือกด 'กำหนดเอง' เพื่อพิมพ์ชื่อ UPPER_SNAKE_CASE"
              : "Pick a preset or choose 'Custom' to type your own UPPER_SNAKE_CASE name"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Category + preset pickers */}
          <div className="grid md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">{lang === "th" ? "หมวดหมู่" : "Category"}</Label>
              <Select
                value={presetCat}
                onValueChange={(v) => {
                  setPresetCat(v);
                  setPresetKey("");
                  setCustomMode(v === "general");
                  setNewCat(v);
                  setNewKey("");
                  setNewDesc("");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECRET_PRESET_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{lang === "th" ? "Secret ที่จะเพิ่ม" : "Secret to add"}</Label>
              <Select
                value={presetKey}
                onValueChange={(v) => {
                  setPresetKey(v);
                  if (v === "__custom__") {
                    setCustomMode(true);
                    setNewKey(""); setNewDesc("");
                  } else {
                    setCustomMode(false);
                    const p = SECRET_PRESET_CATEGORIES
                      .find((c) => c.id === presetCat)?.presets
                      .find((pp: SecretPreset) => pp.key === v);
                    if (p) { setNewKey(p.key); setNewDesc(p.description); }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={lang === "th" ? "เลือก..." : "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {SECRET_PRESET_CATEGORIES.find((c) => c.id === presetCat)?.presets
                    .filter((p) => p.key)
                    .map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs">{p.key}</span>
                          <span className="text-xs text-muted-foreground">{p.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  <SelectItem value="__custom__">
                    <span className="text-primary">✏️ {lang === "th" ? "กำหนดเอง..." : "Custom..."}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Guide + free-tier hint for the selected preset */}
          {(() => {
            const p = SECRET_PRESET_CATEGORIES
              .find((c) => c.id === presetCat)?.presets
              .find((pp) => pp.key === presetKey);
            const g = newKey ? getSecretGuide(newKey) : null;
            if (!p && !g) return null;
            return (
              <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-sm">
                {p?.freeTier && (
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Free tier: {p.freeTier}</span>
                  </div>
                )}
                {g && (
                  <>
                    <div className="font-semibold">{g.title}</div>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                      {g.steps.map((st, i) => <li key={i}>{st}</li>)}
                    </ol>
                    {g.url && (
                      <a href={g.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExtLinkIcon className="h-3 w-3" /> เปิดหน้าเว็บสำหรับขอ key
                      </a>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* Editable fields (auto-filled from preset, editable if custom) */}
          <div className="grid md:grid-cols-3 gap-2">
            <Input
              placeholder="MY_API_KEY"
              value={newKey}
              readOnly={!customMode && !!presetKey && presetKey !== "__custom__"}
              onChange={(e) => setNewKey(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <Input
              placeholder={lang === "th" ? "คำอธิบาย" : "Description"}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <Button onClick={addNew} disabled={!newKey}>
              <Plus className="h-4 w-4 mr-1" />
              {lang === "th" ? "เพิ่ม" : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

