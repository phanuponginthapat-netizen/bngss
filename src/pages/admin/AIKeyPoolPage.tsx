import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Trash2, Plus, KeyRound, RotateCw, Power, Zap } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";

type Provider =
  | "openai" | "gemini" | "groq" | "openrouter"
  | "cerebras" | "glm" | "huggingface" | "github" | "sambanova" | "cohere"
  | "deepseek" | "mistral" | "together" | "xai" | "fireworks" | "nvidia"
  | "dashscope" | "perplexity" | "anthropic";

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

type Info = { name: string; tier: "free" | "credit" | "paid"; help: string; signupUrl: string; placeholder?: string };

const PROVIDER_INFO: Record<Provider, Info> = {
  // Free tier
  gemini:      { name: "Google Gemini", tier: "free", help: "ฟรี 1,500 req/วัน/key", signupUrl: "https://aistudio.google.com/app/apikey", placeholder: "AIza..." },
  groq:        { name: "Groq", tier: "free", help: "ฟรี 14,400 req/วัน — เร็วมาก", signupUrl: "https://console.groq.com/keys", placeholder: "gsk_..." },
  cerebras:    { name: "Cerebras", tier: "free", help: "ฟรี, เร็วสุด", signupUrl: "https://cloud.cerebras.ai/" },
  openrouter:  { name: "OpenRouter", tier: "free", help: "มี free models หลายตัว", signupUrl: "https://openrouter.ai/keys", placeholder: "sk-or-..." },
  glm:         { name: "ZhipuAI GLM-4-Flash", tier: "free", help: "ฟรีถาวร", signupUrl: "https://bigmodel.cn/" },
  huggingface: { name: "HuggingFace", tier: "free", help: "Inference API", signupUrl: "https://huggingface.co/settings/tokens", placeholder: "hf_..." },
  github:      { name: "GitHub Models", tier: "free", help: "ใช้ Personal Access Token", signupUrl: "https://github.com/settings/tokens", placeholder: "ghp_..." },
  sambanova:   { name: "SambaNova", tier: "free", help: "ฟรี tier", signupUrl: "https://cloud.sambanova.ai/" },
  cohere:      { name: "Cohere", tier: "free", help: "Trial key ฟรี", signupUrl: "https://dashboard.cohere.com/" },
  // Credit
  deepseek:    { name: "DeepSeek", tier: "credit", help: "มีเครดิตแรกเข้า", signupUrl: "https://platform.deepseek.com/", placeholder: "sk-..." },
  mistral:     { name: "Mistral", tier: "credit", help: "ฟรี tier", signupUrl: "https://console.mistral.ai/" },
  together:    { name: "Together AI", tier: "credit", help: "เครดิต $5", signupUrl: "https://api.together.xyz/" },
  xai:         { name: "xAI Grok", tier: "credit", help: "เครดิต $150/เดือน", signupUrl: "https://console.x.ai/", placeholder: "xai-..." },
  fireworks:   { name: "Fireworks", tier: "credit", help: "ฟรี tier", signupUrl: "https://fireworks.ai/api-keys" },
  nvidia:      { name: "NVIDIA NIM", tier: "credit", help: "เครดิต 1,000", signupUrl: "https://build.nvidia.com/" },
  dashscope:   { name: "DashScope Qwen", tier: "credit", help: "Alibaba Qwen", signupUrl: "https://dashscope.console.aliyun.com/" },
  perplexity:  { name: "Perplexity", tier: "credit", help: "Sonar API", signupUrl: "https://www.perplexity.ai/settings/api", placeholder: "pplx-..." },
  // Paid
  openai:      { name: "OpenAI (ChatGPT)", tier: "paid", help: "เสียเงินตามการใช้งาน", signupUrl: "https://platform.openai.com/api-keys", placeholder: "sk-proj-..." },
  anthropic:   { name: "Anthropic Claude", tier: "paid", help: "เสียเงินตามการใช้งาน", signupUrl: "https://console.anthropic.com/", placeholder: "sk-ant-..." },
};

const TIER_LABEL: Record<Info["tier"], string> = {
  free: "🆓 ฟรี",
  credit: "💳 ฟรีเครดิต",
  paid: "💰 เสียเงิน",
};

const TIER_COLOR: Record<Info["tier"], string> = {
  free: "bg-emerald-100 text-emerald-700 border-emerald-300",
  credit: "bg-blue-100 text-blue-700 border-blue-300",
  paid: "bg-amber-100 text-amber-700 border-amber-300",
};

const MAX_KEYS_PER_PROVIDER = 20;
const ALL_PROVIDERS = Object.keys(PROVIDER_INFO) as Provider[];

export default function AIKeyPoolPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Provider>("gemini");
  const [bulkKeys, setBulkKeys] = useState("");
  const [labelPrefix, setLabelPrefix] = useState("");

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["ai_provider_keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_provider_keys_meta" as any)
        .select("id,provider_type,label,status,used_today,used_total,last_error,cooldown_until,created_at,has_key")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({ ...r, api_key: "" })) as unknown as KeyRow[];
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

  const info = PROVIDER_INFO[activeTab];
  const list = keysByProvider(activeTab);
  const activeCount = list.filter(k => k.status === "active").length;
  const totalToday = list.reduce((s, k) => s + (k.used_today || 0), 0);

  const grouped: Record<Info["tier"], Provider[]> = { free: [], credit: [], paid: [] };
  ALL_PROVIDERS.forEach(p => grouped[PROVIDER_INFO[p].tier].push(p));

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

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <Select value={activeTab} onValueChange={(v) => setActiveTab(v as Provider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {(["free", "credit", "paid"] as const).map(tier => (
                    <SelectGroup key={tier}>
                      <SelectLabel>{TIER_LABEL[tier]}</SelectLabel>
                      {grouped[tier].map(p => (
                        <SelectItem key={p} value={p}>
                          {PROVIDER_INFO[p].name}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({keysByProvider(p).length})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleResetUsage(activeTab)}>
              <RotateCw className="w-4 h-4 mr-1" /> รีเซ็ตใช้งานวันนี้
            </Button>
          </div>
          <div>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Badge className={TIER_COLOR[info.tier]}>{TIER_LABEL[info.tier]}</Badge>
              <span>{info.name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {activeCount} active · {totalToday} req วันนี้
              </span>
            </CardTitle>
            <CardDescription className="mt-1">
              {info.help} ·{" "}
              <a href={info.signupUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                ขอ key ฟรี
              </a>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk add */}
          <div className="border-2 border-dashed rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2 font-semibold">
              <Plus className="w-4 h-4" /> เพิ่มหลาย keys พร้อมกัน (วางทีละบรรทัด หรือคั่นด้วย ,)
            </div>
            <Textarea
              value={bulkKeys}
              onChange={(e) => setBulkKeys(e.target.value)}
              placeholder={info.placeholder ? `${info.placeholder}\n${info.placeholder}` : "paste keys here..."}
              rows={5}
              className="font-mono text-xs"
            />
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="คำนำหน้า label (เช่น personal, work)"
                value={labelPrefix}
                onChange={(e) => setLabelPrefix(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={handleBulkAdd}>
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
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">Active</Badge>
                        )}
                        {k.status === "cooldown" && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300">
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
                        <Power className={`w-4 h-4 ${k.status === "disabled" ? "text-muted-foreground" : "text-emerald-600"}`} />
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

      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="p-4 text-sm space-y-1">
          <div className="font-semibold text-blue-900">💡 วิธีทำงาน</div>
          <ul className="list-disc pl-5 text-blue-800 space-y-1">
            <li>ระบบจะเลือก key ที่ <b>ใช้น้อยสุด</b>โดยอัตโนมัติ (round-robin by usage)</li>
            <li>ถ้า key ใดโดน <b>429/402/403</b> ระบบจะพักไว้ 1 ชั่วโมงแล้วลอง key ถัดไป</li>
            <li>นับ used_today รีเซ็ตอัตโนมัติทุกวันเมื่อมีการเรียกใช้ครั้งแรก</li>
            <li>รองรับ {ALL_PROVIDERS.length} providers — จัดกลุ่มตาม ฟรี / ฟรีเครดิต / เสียเงิน</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
