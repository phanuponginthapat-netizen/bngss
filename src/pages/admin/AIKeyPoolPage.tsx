import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, KeyRound, RotateCw, Power, Zap } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";

type Provider = "gemini" | "groq" | "openrouter";

type KeyRow = {
  id: string;
  provider_type: Provider;
  api_key: string;
  label: string | null;
  status: "active" | "cooldown" | "disabled";
  used_today: number;
  used_total: number;
  cooldown_until: string | null;
  last_used_at: string | null;
  last_error: string | null;
};

const PROVIDER_INFO: Record<Provider, { name: string; color: string; help: string; signupUrl: string }> = {
  gemini: {
    name: "Google Gemini",
    color: "bg-info-soft text-info border-info/30",
    help: "ฟรี 1,500 requests/วัน/key — สมัครที่ aistudio.google.com",
    signupUrl: "https://aistudio.google.com/app/apikey",
  },
  groq: {
    name: "Groq",
    color: "bg-warning-soft text-warning border-warning/30",
    help: "ฟรี 14,400 requests/วัน/key — เร็วมาก",
    signupUrl: "https://console.groq.com/keys",
  },
  openrouter: {
    name: "OpenRouter",
    color: "bg-info-soft text-info border-info/30",
    help: "มี free models หลายตัว (deepseek/qwen) — $0/วัน",
    signupUrl: "https://openrouter.ai/keys",
  },
};

const MAX_KEYS_PER_PROVIDER = 20;

export default function AIKeyPoolPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Provider>("gemini");
  const [bulkKeys, setBulkKeys] = useState("");
  const [labelPrefix, setLabelPrefix] = useState("");

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["ai_provider_keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_provider_keys" as any)
        .select("id,provider_type,label,status,used_today,used_total,last_error,cooldown_until,created_at,api_key")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]) as unknown as KeyRow[];
    },
  });


  const keysByProvider = (p: Provider) => keys.filter(k => k.provider_type === p);

  const handleBulkAdd = async () => {
    const lines = bulkKeys.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error("ใส่ API key อย่างน้อย 1 ตัว");
      return;
    }
    const existing = keysByProvider(activeTab).length;
    if (existing + lines.length > MAX_KEYS_PER_PROVIDER) {
      toast.error(`ใส่ได้สูงสุด ${MAX_KEYS_PER_PROVIDER} keys ต่อ provider (มีแล้ว ${existing})`);
      return;
    }

    const rows = lines.map((key, i) => ({
      provider_type: activeTab,
      api_key: key,
      label: labelPrefix ? `${labelPrefix}-${existing + i + 1}` : `${activeTab}-${existing + i + 1}`,
      status: "active",
    }));

    const { error } = await supabase.from("ai_provider_keys" as any).insert(rows as any);
    if (error) {
      toast.error("เพิ่ม keys ไม่สำเร็จ: " + error.message);
      return;
    }
    toast.success(`เพิ่ม ${lines.length} keys สำเร็จ`);
    setBulkKeys("");
    setLabelPrefix("");
    qc.invalidateQueries({ queryKey: ["ai_provider_keys"] });
  };

  const handleDelete = async (id: string) => {
    const ok = await swal.confirm({ title: "ลบ key นี้?", text: "ไม่สามารถกู้คืนได้" });
    if (!ok) return;
    await supabase.from("ai_provider_keys" as any).delete().eq("id", id);
    toast.success("ลบแล้ว");
    qc.invalidateQueries({ queryKey: ["ai_provider_keys"] });
  };

  const handleToggle = async (k: KeyRow) => {
    const newStatus = k.status === "disabled" ? "active" : "disabled";
    await supabase.from("ai_provider_keys" as any).update({ status: newStatus, cooldown_until: null }).eq("id", k.id);
    qc.invalidateQueries({ queryKey: ["ai_provider_keys"] });
  };

  const handleResetCooldown = async (id: string) => {
    await supabase.from("ai_provider_keys" as any).update({
      status: "active",
      cooldown_until: null,
      last_error: null,
    }).eq("id", id);
    toast.success("รีเซ็ตแล้ว");
    qc.invalidateQueries({ queryKey: ["ai_provider_keys"] });
  };

  const handleResetUsage = async (provider: Provider) => {
    await supabase.from("ai_provider_keys" as any).update({ used_today: 0 }).eq("provider_type", provider);
    toast.success("รีเซ็ตการใช้งานวันนี้แล้ว");
    qc.invalidateQueries({ queryKey: ["ai_provider_keys"] });
  };

  const maskKey = (key: string) => {
    if (key.length <= 12) return "•".repeat(key.length);
    return key.slice(0, 6) + "•".repeat(Math.max(0, key.length - 10)) + key.slice(-4);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <KeyRound className="w-7 h-7 text-primary" />
          API Key Pool
        </h1>
        <p className="text-muted-foreground mt-1">
          จัดเก็บ API keys หลายตัวต่อ provider เพื่อเพิ่มโควต้าและกระจายโหลด — สูงสุด {MAX_KEYS_PER_PROVIDER} keys/provider
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Provider)}>
        <TabsList className="grid grid-cols-3 w-full max-w-2xl">
          {(Object.keys(PROVIDER_INFO) as Provider[]).map(p => (
            <TabsTrigger key={p} value={p}>
              {PROVIDER_INFO[p].name}
              <Badge variant="secondary" className="ml-2">{keysByProvider(p).length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {(Object.keys(PROVIDER_INFO) as Provider[]).map(p => {
          const info = PROVIDER_INFO[p];
          const list = keysByProvider(p);
          const activeCount = list.filter(k => k.status === "active").length;
          const totalToday = list.reduce((s, k) => s + (k.used_today || 0), 0);

          return (
            <TabsContent key={p} value={p} className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Badge className={info.color}>{info.name}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {activeCount} active · {totalToday} requests วันนี้
                        </span>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {info.help} ·{" "}
                        <a href={info.signupUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                          ขอ key ฟรี
                        </a>
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleResetUsage(p)}>
                      <RotateCw className="w-4 h-4 mr-1" /> รีเซ็ตใช้งานวันนี้
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Bulk add */}
                  <div className="border-2 border-dashed rounded-lg p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2 font-semibold">
                      <Plus className="w-4 h-4" /> เพิ่มหลาย keys พร้อมกัน (วางทีละบรรทัด หรือคั่นด้วย ,)
                    </div>
                    <Textarea
                      value={activeTab === p ? bulkKeys : ""}
                      onChange={(e) => setBulkKeys(e.target.value)}
                      placeholder={`AIza...\nAIza...\nAIza...`}
                      rows={5}
                      className="font-mono text-xs"
                    />
                    <div className="flex gap-2 flex-wrap">
                      <Input
                        placeholder="คำนำหน้า label (เช่น personal, work)"
                        value={activeTab === p ? labelPrefix : ""}
                        onChange={(e) => setLabelPrefix(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button onClick={handleBulkAdd} disabled={activeTab !== p}>
                        <Plus className="w-4 h-4 mr-1" /> เพิ่ม Keys
                      </Button>
                    </div>
                  </div>

                  {/* Keys list */}
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
                  ) : list.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <KeyRound className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      ยังไม่มี key — เพิ่มได้ที่ช่องด้านบน
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {list.map(k => {
                        const cooldownLeft = k.cooldown_until
                          ? Math.max(0, Math.round((new Date(k.cooldown_until).getTime() - Date.now()) / 60000))
                          : 0;
                        return (
                          <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/20">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{k.label || "(ไม่มีชื่อ)"}</span>
                                {k.status === "active" && (
                                  <Badge className="bg-success-soft text-success border-success/30">Active</Badge>
                                )}
                                {k.status === "cooldown" && (
                                  <Badge className="bg-warning-soft text-warning border-warning/30">
                                    Cooldown ({cooldownLeft}m)
                                  </Badge>
                                )}
                                {k.status === "disabled" && (
                                  <Badge variant="secondary">Disabled</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  <Zap className="inline w-3 h-3" /> {k.used_today} วันนี้ · {k.used_total} รวม
                                </span>
                              </div>
                              <code className="text-xs text-muted-foreground font-mono block truncate mt-1">
                                {k.label || "•••• (ซ่อนเพื่อความปลอดภัย)"}
                              </code>

                              {k.last_error && (
                                <div className="text-xs text-destructive mt-1 truncate">⚠️ {k.last_error}</div>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {k.status === "cooldown" && (
                                <Button size="sm" variant="ghost" onClick={() => handleResetCooldown(k.id)} title="ปลด cooldown">
                                  <RotateCw className="w-4 h-4" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => handleToggle(k)} title={k.status === "disabled" ? "เปิด" : "ปิด"}>
                                <Power className={`w-4 h-4 ${k.status === "disabled" ? "text-muted-foreground" : "text-success"}`} />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(k.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-info/50 border-info/30">
                <CardContent className="p-4 text-sm space-y-1">
                  <div className="font-semibold text-info">💡 วิธีทำงาน</div>
                  <ul className="list-disc pl-5 text-info space-y-1">
                    <li>ระบบจะเลือก key ที่ <b>ใช้น้อยสุด</b>โดยอัตโนมัติ (round-robin by usage)</li>
                    <li>ถ้า key ใดโดน <b>429/402/403</b> ระบบจะพักไว้ 1 ชั่วโมงแล้วลอง key ถัดไป</li>
                    <li>นับ used_today จะรีเซ็ตอัตโนมัติทุกวันตอนเที่ยงคืน (เมื่อมีการเรียกใช้)</li>
                    <li>Pool นี้ใช้สำหรับ AI Chat / OCR / สรุปข้อมูล — ไม่กระทบ Lovable AI</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
